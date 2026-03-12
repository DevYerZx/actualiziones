import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { pipeline } from "stream/promises";

const API_BASE = "https://dv-yer-api.online";
const API_APK_SEARCH_URL = `${API_BASE}/apksearch`;
const API_APK_DOWNLOAD_URL = `${API_BASE}/apkdl`;

const COOLDOWN_TIME = 15 * 1000;
const REQUEST_TIMEOUT = 120000;
const MAX_FILE_BYTES = 800 * 1024 * 1024;
const APK_PREFERENCE = "apk";
const API_LANG = "es";
const TMP_DIR = path.join(os.tmpdir(), "dvyer-apk");

const cooldowns = new Map();

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function safeFileName(name) {
  return (
    String(name || "app")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "app"
  );
}

function normalizePackageFileName(name, format) {
  const raw = String(name || "").trim();
  const ext =
    /\.xapk$/i.test(raw) || String(format || "").toLowerCase() === "xapk"
      ? "xapk"
      : "apk";

  const base = safeFileName(raw.replace(/\.(apk|xapk)$/i, "") || "app");
  return `${base}.${ext}`;
}

function mimeFromFileName(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".xapk")) return "application/xapk-package-archive";
  if (lower.endsWith(".apk")) return "application/vnd.android.package-archive";
  return "application/octet-stream";
}

function getCooldownRemaining(untilMs) {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}

function extractTextFromMessage(message) {
  return (
    message?.text ||
    message?.caption ||
    message?.body ||
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    ""
  );
}

function getQuotedMessage(ctx, msg) {
  return (
    ctx?.quoted ||
    msg?.quoted ||
    msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    null
  );
}

function resolveUserInput(ctx) {
  const msg = ctx.m || ctx.msg || null;
  const argsText = Array.isArray(ctx.args) ? ctx.args.join(" ").trim() : "";
  const quotedMessage = getQuotedMessage(ctx, msg);
  const quotedText = extractTextFromMessage(quotedMessage);
  return argsText || quotedText || "";
}

function isSupportedAppUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function buildApiParams(input, mode) {
  const params = {
    mode,
    prefer: APK_PREFERENCE,
    lang: API_LANG,
  };

  if (isSupportedAppUrl(input)) params.url = input;
  else params.q = input;

  return params;
}

function extractApiError(data, status) {
  return (
    data?.detail ||
    data?.error?.message ||
    data?.message ||
    (status ? `HTTP ${status}` : "Error de API")
  );
}

function parseContentDispositionFileName(headerValue) {
  const text = String(headerValue || "");
  const utfMatch = text.match(/filename\*=UTF-8''([^;]+)/i);

  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).replace(/["']/g, "").trim();
    } catch {}
  }

  const normalMatch = text.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1].trim();
  }

  return "";
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

function normalizeApiUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  return `${API_BASE}/${value}`;
}

function trimText(value, max = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function humanBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size || size < 1) return null;

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

async function readStreamToText(stream) {
  return await new Promise((resolve, reject) => {
    let data = "";

    stream.on("data", (chunk) => {
      data += chunk.toString();
    });

    stream.on("end", () => resolve(data));
    stream.on("error", reject);
  });
}

async function apiGet(url, params, timeout = REQUEST_TIMEOUT) {
  const response = await axios.get(url, {
    timeout,
    params,
    validateStatus: () => true,
  });

  const data = response.data;

  if (response.status >= 400) {
    throw new Error(extractApiError(data, response.status));
  }

  if (data?.ok === false || data?.status === false) {
    throw new Error(extractApiError(data, response.status));
  }

  return data;
}

async function searchBestApp(query) {
  const data = await apiGet(
    API_APK_SEARCH_URL,
    {
      q: query,
      limit: 1,
      lang: API_LANG,
    },
    REQUEST_TIMEOUT
  );

  const first = data?.results?.[0];
  if (!first) {
    throw new Error("No se encontró ninguna app.");
  }

  return {
    title: safeFileName(first.title || "app"),
    packageName: first.package_name || null,
    version: first.version || null,
    versionCode: first.version_code || null,
    filesizeBytes: first.filesize_bytes || null,
    icon: first.icon || null,
    downloadQuery: String(first.download_query || first.title || query).trim(),
  };
}

async function requestApkMeta(input) {
  const data = await apiGet(
    API_APK_DOWNLOAD_URL,
    buildApiParams(input, "link"),
    REQUEST_TIMEOUT
  );

  const downloadUrl = normalizeApiUrl(
    data?.download_url_full || data?.download_url || data?.stream_url_full || data?.stream_url || ""
  );

  if (!downloadUrl) {
    throw new Error("La API no devolvió enlace interno de descarga.");
  }

  return {
    title: safeFileName(data?.title || data?.package_name || "app"),
    fileName: normalizePackageFileName(
      data?.filename || "app.apk",
      data?.format || data?.download_type || "apk"
    ),
    packageName: data?.package_name || null,
    version: data?.version || null,
    versionCode: data?.version_code || null,
    format: String(data?.format || data?.download_type || "apk").toLowerCase() || "apk",
    icon: data?.icon || null,
    description: trimText(data?.description || ""),
    filesizeBytes: data?.filesize_bytes || null,
    downloadUrl,
  };
}

async function downloadApkFromInternalLink(downloadUrl, outputPath, suggestedFileName, format) {
  const response = await axios.get(downloadUrl, {
    responseType: "stream",
    timeout: REQUEST_TIMEOUT,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      Accept: "*/*",
      Referer: `${API_BASE}/`,
    },
    validateStatus: () => true,
    maxRedirects: 5,
  });

  if (response.status >= 400) {
    const errorText = await readStreamToText(response.data).catch(() => "");
    throw new Error(
      extractApiError(
        { message: errorText || "No se pudo descargar el archivo." },
        response.status
      )
    );
  }

  const contentLength = Number(response.headers?.["content-length"] || 0);
  if (contentLength && contentLength > MAX_FILE_BYTES) {
    throw new Error("El archivo es demasiado grande para enviarlo por WhatsApp.");
  }

  let downloaded = 0;

  response.data.on("data", (chunk) => {
    downloaded += chunk.length;
    if (downloaded > MAX_FILE_BYTES) {
      response.data.destroy(new Error("El archivo es demasiado grande para enviarlo por WhatsApp."));
    }
  });

  try {
    await pipeline(response.data, fs.createWriteStream(outputPath));
  } catch (error) {
    deleteFileSafe(outputPath);
    throw error;
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error("No se pudo guardar el archivo.");
  }

  const size = fs.statSync(outputPath).size;
  if (!size || size < 50000) {
    deleteFileSafe(outputPath);
    throw new Error("El archivo descargado es inválido.");
  }

  if (size > MAX_FILE_BYTES) {
    deleteFileSafe(outputPath);
    throw new Error("El archivo es demasiado grande para enviarlo por WhatsApp.");
  }

  const detectedName = parseContentDispositionFileName(
    response.headers?.["content-disposition"]
  );

  const finalFileName = normalizePackageFileName(
    detectedName || suggestedFileName || "app.apk",
    format || "apk"
  );

  return {
    tempPath: outputPath,
    size,
    fileName: finalFileName,
    mime: mimeFromFileName(finalFileName),
  };
}

function buildPreviewCaption(info) {
  const lines = [
    "api dvyer",
    "",
    `📲 ${info.title || "App"}`,
  ];

  if (info.version) lines.push(`🏷️ Version: ${info.version}`);
  if (info.packageName) lines.push(`📦 Paquete: ${info.packageName}`);
  if (info.format) lines.push(`📁 Formato: ${String(info.format).toUpperCase()}`);

  const humanSize = humanBytes(info.filesizeBytes);
  if (humanSize) lines.push(`💾 Tamaño: ${humanSize}`);

  if (info.description) {
    lines.push("");
    lines.push(info.description);
  }

  return lines.join("\n");
}

async function sendPreviewCard(sock, from, quoted, info) {
  const caption = buildPreviewCaption(info);

  if (info.icon) {
    await sock.sendMessage(
      from,
      {
        image: { url: info.icon },
        caption,
        ...global.channelInfo,
      },
      quoted
    );
    return;
  }

  await sock.sendMessage(
    from,
    {
      text: caption,
      ...global.channelInfo,
    },
    quoted
  );
}

async function sendApkDocument(sock, from, quoted, { filePath, fileName, mime, title, packageName, version, size, format }) {
  const extra = [];
  if (packageName) extra.push(`📦 ${packageName}`);
  if (version) extra.push(`🏷️ ${version}`);
  if (format) extra.push(`📁 ${String(format).toUpperCase()}`);
  const humanSizeValue = humanBytes(size);
  if (humanSizeValue) extra.push(`💾 ${humanSizeValue}`);

  await sock.sendMessage(
    from,
    {
      document: { url: filePath },
      mimetype: mime,
      fileName,
      caption: `api dvyer\n\n📲 ${title}${extra.length ? `\n${extra.join("\n")}` : ""}`,
      ...global.channelInfo,
    },
    quoted
  );
}

export default {
  command: ["apk"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const userId = `${from}:apk`;

    let tempPath = null;

    const until = cooldowns.get(userId);
    if (until && until > Date.now()) {
      return sock.sendMessage(from, {
        text: `⏳ Espera ${getCooldownRemaining(until)}s`,
        ...global.channelInfo,
      });
    }

    cooldowns.set(userId, Date.now() + COOLDOWN_TIME);

    try {
      const userInput = resolveUserInput(ctx);

      if (!userInput) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text: "❌ Uso: .apk <nombre de app o url>",
          ...global.channelInfo,
        });
      }

      await sock.sendMessage(
        from,
        {
          text: `📦 Buscando app...\n\n🌐 ${API_BASE}\n🔎 ${userInput}`,
          ...global.channelInfo,
        },
        quoted
      );

      let searchInfo = null;
      let resolvedInput = userInput;

      if (!isSupportedAppUrl(userInput)) {
        searchInfo = await searchBestApp(userInput);
        resolvedInput = searchInfo.downloadQuery || searchInfo.title || userInput;
      }

      const info = await requestApkMeta(resolvedInput);

      await sendPreviewCard(sock, from, quoted, {
        title: info.title || searchInfo?.title,
        packageName: info.packageName || searchInfo?.packageName,
        version: info.version || searchInfo?.version,
        format: info.format,
        filesizeBytes: info.filesizeBytes || searchInfo?.filesizeBytes,
        icon: info.icon || searchInfo?.icon,
        description: info.description,
      });

      tempPath = path.join(
        TMP_DIR,
        `${Date.now()}-${normalizePackageFileName(info.fileName, info.format)}`
      );

      const downloaded = await downloadApkFromInternalLink(
        info.downloadUrl,
        tempPath,
        info.fileName,
        info.format
      );

      await sendApkDocument(sock, from, quoted, {
        filePath: downloaded.tempPath,
        fileName: downloaded.fileName,
        mime: downloaded.mime,
        title: info.title,
        packageName: info.packageName,
        version: info.version,
        size: downloaded.size,
        format: info.format,
      });
    } catch (err) {
      console.error("APK ERROR:", err?.message || err);
      cooldowns.delete(userId);

      await sock.sendMessage(from, {
        text: `❌ ${String(err?.message || "No se pudo procesar la app.")}`,
        ...global.channelInfo,
      });
    } finally {
      deleteFileSafe(tempPath);
    }
  },
};
