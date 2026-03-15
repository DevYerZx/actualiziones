import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { pipeline } from "stream/promises";

const API_BASE = "https://dv-yer-api.online";
const API_APK_URL = `${API_BASE}/apkdl`;

const COOLDOWN_TIME = 15 * 1000;
const REQUEST_TIMEOUT = 180000;
const MAX_FILE_BYTES = 800 * 1024 * 1024;
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

function resolveRawInput(ctx) {
  const msg = ctx.m || ctx.msg || null;
  const argsText = Array.isArray(ctx.args) ? ctx.args.join(" ").trim() : "";
  const quotedMessage = getQuotedMessage(ctx, msg);
  const quotedText = extractTextFromMessage(quotedMessage);
  return argsText || quotedText || "";
}

function parsePreferenceAndTarget(rawInput) {
  const text = String(rawInput || "").trim();
  if (!text) {
    return { prefer: "apk", target: "" };
  }

  const parts = text.split(/\s+/);
  const first = String(parts[0] || "").toLowerCase();

  if (["apk", "xapk", "auto"].includes(first)) {
    return {
      prefer: first,
      target: parts.slice(1).join(" ").trim(),
    };
  }

  return {
    prefer: "apk",
    target: text,
  };
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function buildApiParams(input, mode, prefer) {
  const params = {
    mode,
    prefer: prefer || "apk",
    lang: "es",
  };

  if (isHttpUrl(input)) params.url = input;
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

async function requestAppInfo(input, prefer) {
  const data = await apiGet(API_APK_URL, buildApiParams(input, "link", prefer));

  return {
    title: safeFileName(data?.title || data?.package_name || "app"),
    fileName: normalizePackageFileName(
      data?.filename || "app.apk",
      data?.download_type || data?.format || "apk"
    ),
    packageName: data?.package_name || null,
    version: data?.version || null,
    format: String(data?.download_type || data?.format || "apk").toLowerCase() || "apk",
    icon: data?.icon || null,
    description: String(data?.description || "").trim() || null,
    publishedAt: data?.published_at || null,
    requirements: data?.requirements || null,
    architecture: data?.architecture || null,
    filesizeBytes: data?.filesize_bytes || null,
  };
}

async function downloadAppFile(input, prefer, outputPath, suggestedFileName, format) {
  const response = await axios.get(API_APK_URL, {
    responseType: "stream",
    timeout: REQUEST_TIMEOUT,
    params: buildApiParams(input, "file", prefer),
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

function buildPreviewCaption(info, prefer) {
  const lines = [
    "api dvyer",
    "",
    `📦 ${info.title || "App"}`,
  ];

  if (prefer) lines.push(`🎯 Pedido: ${String(prefer).toUpperCase()}`);
  if (info.format) lines.push(`📁 Formato: ${String(info.format).toUpperCase()}`);
  if (info.version) lines.push(`🏷️ Version: ${info.version}`);
  if (info.packageName) lines.push(`📦 Paquete: ${info.packageName}`);

  const size = humanBytes(info.filesizeBytes);
  if (size) lines.push(`💾 Tamaño: ${size}`);

  if (info.publishedAt) lines.push(`📅 Actualizado: ${info.publishedAt}`);
  if (info.requirements) lines.push(`📱 SO: ${info.requirements}`);
  if (info.architecture) lines.push(`🧩 Arquitectura: ${info.architecture}`);

  if (info.description) {
    lines.push("");
    lines.push(info.description.length > 260 ? `${info.description.slice(0, 257)}...` : info.description);
  }

  return lines.join("\n");
}

async function sendPreview(sock, from, quoted, info, prefer) {
  const caption = buildPreviewCaption(info, prefer);

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

async function sendPackageDocument(sock, from, quoted, options) {
  const { filePath, fileName, mime, title, version, packageName, format, size } = options;

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
      caption: `api dvyer\n\n📦 ${title}${extra.length ? `\n${extra.join("\n")}` : ""}`,
      ...global.channelInfo,
    },
    quoted
  );
}

export default {
  command: ["apk", "app"],
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
      const rawInput = resolveRawInput(ctx);
      const parsed = parsePreferenceAndTarget(rawInput);
      const prefer = parsed.prefer;
      const target = parsed.target;

      if (!target) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text: "❌ Uso: .apk <nombre o url>\n❌ Uso: .apk xapk <nombre o url>\n❌ Uso: .apk auto <nombre o url>",
          ...global.channelInfo,
        });
      }

      await sock.sendMessage(
        from,
        {
          text: `📦 Buscando app...\n\n🌐 ${API_BASE}\n🔎 ${target}\n🎯 Preferencia: ${prefer.toUpperCase()}`,
          ...global.channelInfo,
        },
        quoted
      );

      const info = await requestAppInfo(target, prefer);

      await sendPreview(sock, from, quoted, info, prefer);

      tempPath = path.join(
        TMP_DIR,
        `${Date.now()}-${normalizePackageFileName(info.fileName, info.format)}`
      );

      const downloaded = await downloadAppFile(
        target,
        prefer,
        tempPath,
        info.fileName,
        info.format
      );

      await sendPackageDocument(sock, from, quoted, {
        filePath: downloaded.tempPath,
        fileName: downloaded.fileName,
        mime: downloaded.mime,
        title: info.title,
        version: info.version,
        packageName: info.packageName,
        format: info.format,
        size: downloaded.size,
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

