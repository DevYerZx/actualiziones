import axios from "axios";
import { buildDvyerUrl, getDvyerBaseUrl } from "../../lib/api-manager.js";

const API_BASE = getDvyerBaseUrl();
const API_VIDEO_URL = buildDvyerUrl("/ytdlmp4");
const API_SEARCH_URL = buildDvyerUrl("/ytsearch");
const VIDEO_QUALITY = "360p";
const COOLDOWN_MS = 8000;

const cooldowns = new Map();

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

function extractYouTubeUrl(text) {
  const match = String(text || "").match(
    /https?:\/\/(?:www\.)?(?:youtube\.com|music\.youtube\.com|youtu\.be)\/[^\s]+/i
  );
  return match ? match[0].trim() : "";
}

function normalizeYouTubeUrl(input) {
  try {
    const url = new URL(String(input || "").trim());
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

function safeText(text, max = 120) {
  return String(text || "video").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeMp4Name(name) {
  const clean = safeText(String(name || "video").replace(/\.mp4$/i, ""), 80)
    .replace(/[\\/:*?"<>|]/g, "");
  return `${clean || "video"}.mp4`;
}

function getCooldownRemaining(untilMs) {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}

async function apiGet(url, params, timeout = 45000) {
  const response = await axios.get(url, {
    timeout,
    params,
    validateStatus: () => true,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
    },
  });

  if (response.status >= 400) {
    throw new Error(
      response?.data?.detail ||
        response?.data?.message ||
        `HTTP ${response.status}`
    );
  }

  if (response.data?.ok === false || response.data?.status === false) {
    throw new Error(
      response?.data?.detail ||
        response?.data?.message ||
        "La API devolvió error."
    );
  }

  return response.data;
}

async function resolveSearch(query) {
  const data = await apiGet(API_SEARCH_URL, { q: query, limit: 1 }, 25000);
  const first = data?.results?.[0];

  if (!first?.url) {
    throw new Error("No se encontró el video.");
  }

  return {
    url: normalizeYouTubeUrl(first.url),
    title: safeText(first.title || "video"),
    thumbnail: first.thumbnail || null,
  };
}

async function getDirectVideo(videoUrl) {
  const data = await apiGet(API_VIDEO_URL, {
    mode: "link",
    url: videoUrl,
    quality: VIDEO_QUALITY,
  });

  const mediaUrl = normalizeApiUrl(pickApiDownloadUrl(data));
  if (!mediaUrl) {
    throw new Error("La API no devolvió enlace de descarga.");
  }

  return {
    title: safeText(data?.title || "video"),
    fileName: normalizeMp4Name(data?.filename || data?.title || "video"),
    mediaUrl,
    streamUrl: normalizeApiUrl(data?.stream_url_full || data?.stream_url || ""),
    quality: data?.quality_requested || VIDEO_QUALITY,
    duration: data?.duration || "",
  };
}

async function sendRemoteVideo(sock, from, quoted, info) {
  return await sock.sendMessage(
    from,
    {
      video: { url: info.mediaUrl },
      mimetype: "video/mp4",
      fileName: info.fileName,
      caption:
        `api dvyer\n\n` +
        `🎬 ${info.title}\n` +
        `🎚️ ${info.quality}` +
        (info.duration ? `\n⏱️ ${info.duration}` : ""),
      ...global.channelInfo,
    },
    quoted
  );
}

async function sendRemoteDocument(sock, from, quoted, info) {
  return await sock.sendMessage(
    from,
    {
      document: { url: info.mediaUrl },
      mimetype: "video/mp4",
      fileName: info.fileName,
      caption:
        `api dvyer\n\n` +
        `🎬 ${info.title}\n` +
        `🎚️ ${info.quality}\n` +
        `📦 Enviado como documento`,
      ...global.channelInfo,
    },
    quoted
  );
}

export default {
  command: ["ytmp4"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const userId = `${from}:ytmp4fast`;

    const until = cooldowns.get(userId);
    if (until && until > Date.now()) {
      return sock.sendMessage(from, {
        text: `⏳ Espera ${getCooldownRemaining(until)}s`,
        ...global.channelInfo,
      });
    }

    try {
      const rawInput = resolveUserInput(ctx);
      if (!rawInput) {
        return sock.sendMessage(from, {
          text: "❌ Uso: .ytmp4 <link o nombre>",
          ...global.channelInfo,
        });
      }

      cooldowns.set(userId, Date.now() + COOLDOWN_MS);

      let videoUrl = extractYouTubeUrl(rawInput);
      let title = "video";
      let thumbnail = null;

      if (videoUrl) {
        videoUrl = normalizeYouTubeUrl(videoUrl);
        if (!videoUrl) {
          cooldowns.delete(userId);
          return sock.sendMessage(from, {
            text: "❌ Envíame un link válido de YouTube.",
            ...global.channelInfo,
          });
        }
      } else {
        const found = await resolveSearch(rawInput);
        videoUrl = found.url;
        title = found.title;
        thumbnail = found.thumbnail;
      }

      await sock.sendMessage(
        from,
        thumbnail
          ? {
              image: { url: thumbnail },
              caption: `⚡ Procesando...\n\n🎬 ${title}\n🎚️ ${VIDEO_QUALITY}`,
              ...global.channelInfo,
            }
          : {
              text: `⚡ Procesando...\n\n🎬 ${title}\n🎚️ ${VIDEO_QUALITY}`,
              ...global.channelInfo,
            },
        quoted
      );

      const info = await getDirectVideo(videoUrl);

      try {
        await sendRemoteVideo(sock, from, quoted, info);
        return;
      } catch (e1) {
        console.log("ytmp4 remote video fail:", e1?.message || e1);
      }

      try {
        await sendRemoteDocument(sock, from, quoted, info);
        return;
      } catch (e2) {
        console.log("ytmp4 remote document fail:", e2?.message || e2);
      }

      await sock.sendMessage(
        from,
        {
          text:
            `⚠️ No pude adjuntar el archivo directo.\n\n` +
            `🎬 ${info.title}\n` +
            `📥 ${info.mediaUrl}` +
            (info.streamUrl ? `\n▶️ ${info.streamUrl}` : ""),
          ...global.channelInfo,
        },
        quoted
      );
    } catch (err) {
      console.error("YTMP4 ERROR:", err?.message || err);

      await sock.sendMessage(
        from,
        {
          text: `❌ ${String(err?.message || "Error al procesar el video.")}`,
          ...global.channelInfo,
        },
        quoted
      );
    } finally {
      setTimeout(() => cooldowns.delete(userId), COOLDOWN_MS);
    }
  },
};
