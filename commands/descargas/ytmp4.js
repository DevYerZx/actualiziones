import { buildDvyerUrl, getDvyerBaseUrl } from "../../lib/api-manager.js";
import { getDownloadCache, setDownloadCache, withInflightDedup } from "../../lib/download-cache.js";
import { chargeDownloadRequest, refundDownloadCharge } from "../economia/download-access.js";

const API_VIDEO_PATH = "/ytdlmp4";
const API_SEARCH_PATH = "/ytsearch";
const API_BASE = getDvyerBaseUrl();
const API_VIDEO_URL = buildDvyerUrl(API_VIDEO_PATH);
const API_SEARCH_URL = buildDvyerUrl(API_SEARCH_PATH);

const VIDEO_QUALITY = "360p";
const COOLDOWN_TIME = 8 * 1000;

const cooldowns = new Map();

function safeFileName(name) {
  return (
    String(name || "video")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "video"
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function extractYouTubeUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i
  );
  return match ? match[0].trim() : "";
}

function normalizeYouTubeUrl(input) {
  try {
    const raw = String(input || "").trim();
    if (!raw) return "";

    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/watch?v=${id}` : "";
    }

    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "music.youtube.com"
    ) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/watch?v=${id}` : "";
    }

    return "";
  } catch {
    return "";
  }
}

function normalizeApiUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  return `${API_BASE}/${value}`;
}

function pickApiDownloadUrl(data) {
  return (
    data?.download_url_full ||
    data?.stream_url_full ||
    data?.download_url ||
    data?.stream_url ||
    data?.url ||
    data?.result?.download_url_full ||
    data?.result?.stream_url_full ||
    data?.result?.download_url ||
    data?.result?.stream_url ||
    data?.result?.url ||
    ""
  );
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

function getCooldownRemaining(untilMs) {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}

function extractApiError(data, status) {
  return (
    data?.detail ||
    data?.error?.message ||
    data?.message ||
    (status ? `HTTP ${status}` : "Error de API")
  );
}

async function apiGetJson(url, params, timeout = 45000) {
  const axios = (await import("axios")).default;

  const response = await axios.get(url, {
    timeout,
    params,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
    },
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

async function resolveSearch(query) {
  const data = await apiGetJson(API_SEARCH_URL, { q: query, limit: 1 }, 25000);
  const first = data?.results?.[0];

  if (!first?.url) {
    throw new Error("No se encontró el video.");
  }

  return {
    videoUrl: normalizeYouTubeUrl(first.url),
    title: safeFileName(first.title || "video"),
    thumbnail: first.thumbnail || null,
  };
}

async function resolveSearchCached(query) {
  const cacheKey = `ytsearch:${String(query || "").trim().toLowerCase()}`;
  const cached = getDownloadCache(cacheKey);

  if (cached?.videoUrl) return cached;

  return withInflightDedup(cacheKey, async () => {
    const result = await resolveSearch(query);
    setDownloadCache(cacheKey, result);
    return result;
  });
}

async function requestDirectLink(videoUrl) {
  const data = await apiGetJson(
    API_VIDEO_URL,
    {
      mode: "link",
      quality: VIDEO_QUALITY,
      url: videoUrl,
    },
    45000
  );

  const directLink = normalizeApiUrl(pickApiDownloadUrl(data));
  if (!directLink) {
    throw new Error("La API no devolvió un enlace directo.");
  }

  return {
    title: safeFileName(data?.title || "video"),
    videoId: data?.video_id || "",
    qualityRequested: data?.quality_requested || VIDEO_QUALITY,
    quality: data?.quality || "SD",
    duration: data?.duration || "Desconocida",
    format: data?.format || "MP4",
    fileName: data?.filename || "video.mp4",
    directLink,
    streamLink: normalizeApiUrl(data?.stream_url_full || data?.stream_url || ""),
    expiresIn: Number(data?.expires_in_hint_seconds || 1200),
    cached: Boolean(data?.cached),
    source: data?.source || "dvyer",
    creator: data?.creator || "dvyer",
  };
}

async function resolveDirectLinkCached(videoUrl) {
  const cacheKey = `ytfast:${String(videoUrl || "").trim()}`;
  const cached = getDownloadCache(cacheKey);

  if (
    cached?.directLink &&
    cached?.expiresAt &&
    cached.expiresAt > Date.now() + 60000
  ) {
    return cached;
  }

  return withInflightDedup(cacheKey, async () => {
    const result = await requestDirectLink(videoUrl);
    const expiresAt = Date.now() + Math.max(60000, result.expiresIn * 1000);

    const finalResult = {
      ...result,
      expiresAt,
    };

    setDownloadCache(cacheKey, finalResult);
    return finalResult;
  });
}

function toUserErrorMessage(error) {
  const msg = String(error?.message || "").toLowerCase();

  if (msg.includes("no se encontró")) return "❌ No encontré ese video.";
  if (msg.includes("youtube")) return "❌ Envíame un enlace válido de YouTube.";
  if (msg.includes("timeout")) return "❌ La API tardó demasiado en responder.";
  if (msg.includes("http 429")) return "❌ La API está ocupada, intenta en unos segundos.";
  if (msg.includes("http 403")) return "❌ La API rechazó la solicitud.";
  if (msg.includes("http 404")) return "❌ No se encontró el recurso solicitado.";
  if (msg.includes("enlace directo")) return "❌ No pude obtener el enlace directo.";
  return "❌ No pude procesar el video en este momento.";
}

export default {
  command: ["ytfast", "ytrapido", "ytdirect"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const userId = `${from}:ytfast`;

    let downloadCharge = null;

    const until = cooldowns.get(userId);
    if (until && until > Date.now()) {
      return sock.sendMessage(from, {
        text: `⏳ Espera ${getCooldownRemaining(until)}s antes de pedir otro enlace.`,
        ...global.channelInfo,
      });
    }

    try {
      const rawInput = resolveUserInput(ctx);

      if (!rawInput) {
        return sock.sendMessage(from, {
          text: "❌ Uso: .ytfast <nombre o link de YouTube>",
          ...global.channelInfo,
        });
      }

      let videoUrl = extractYouTubeUrl(rawInput);
      let title = "video";
      let thumbnail = null;

      if (videoUrl) {
        videoUrl = normalizeYouTubeUrl(videoUrl);

        if (!videoUrl) {
          return sock.sendMessage(from, {
            text: "❌ Envíame un enlace válido de YouTube.",
            ...global.channelInfo,
          });
        }
      } else {
        if (isHttpUrl(rawInput)) {
          return sock.sendMessage(from, {
            text: "❌ Envíame un link válido de YouTube.",
            ...global.channelInfo,
          });
        }

        const search = await resolveSearchCached(rawInput);
        videoUrl = search.videoUrl;
        title = search.title;
        thumbnail = search.thumbnail;
      }

      cooldowns.set(userId, Date.now() + COOLDOWN_TIME);

      downloadCharge = await chargeDownloadRequest(ctx, {
        feature: "ytfast",
        title,
        videoUrl,
      });

      if (!downloadCharge?.ok) {
        cooldowns.delete(userId);
        return;
      }

      const loadingMessage = thumbnail
        ? {
            image: { url: thumbnail },
            caption:
              `⚡ Obteniendo enlace directo...\n\n` +
              `🎬 ${title}\n` +
              `🎚️ Calidad: ${VIDEO_QUALITY}\n` +
              `🌐 ${API_BASE}`,
            ...global.channelInfo,
          }
        : {
            text:
              `⚡ Obteniendo enlace directo...\n\n` +
              `🎬 ${title}\n` +
              `🎚️ Calidad: ${VIDEO_QUALITY}\n` +
              `🌐 ${API_BASE}`,
            ...global.channelInfo,
          };

      await sock.sendMessage(from, loadingMessage, quoted);

      const result = await resolveDirectLinkCached(videoUrl);
      const finalTitle = safeFileName(result.title || title || "video");

      const text =
        `⚡ *Descarga rápida lista*\n\n` +
        `🎬 *${finalTitle}*\n` +
        `🎚️ Calidad: ${result.qualityRequested}\n` +
        `📦 Formato: ${result.format}\n` +
        `⏱️ Duración: ${result.duration}\n` +
        `🔗 Expira aprox en: ${Math.ceil(result.expiresIn / 60)} min\n\n` +
        `📥 *Descarga directa:*\n${result.directLink}` +
        (result.streamLink ? `\n\n▶️ *Stream:*\n${result.streamLink}` : "");

      await sock.sendMessage(
        from,
        {
          text,
          ...global.channelInfo,
        },
        quoted
      );
    } catch (err) {
      console.error("YTFAST ERROR:", err?.message || err);

      refundDownloadCharge(ctx, downloadCharge, {
        feature: "ytfast",
        error: String(err?.message || err || "unknown_error"),
      });

      await sock.sendMessage(
        from,
        {
          text: toUserErrorMessage(err),
          ...global.channelInfo,
        },
        quoted
      );
    } finally {
      const until = cooldowns.get(userId);
      if (until && until <= Date.now()) {
        cooldowns.delete(userId);
      }
    }
  },
};
