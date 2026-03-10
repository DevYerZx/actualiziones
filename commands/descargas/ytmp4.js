import axios from "axios";
import yts from "yt-search";

const API_BASE = "https://dv-yer-api.online";
const API_URL = `${API_BASE}/ytdl`;

const COOLDOWN_TIME = 15 * 1000;
const DEFAULT_QUALITY = "360p";
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

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

function parseQuality(args) {
  const q = args.find((a) => /^\d{3,4}p$/i.test(a));
  return (q || DEFAULT_QUALITY).toLowerCase();
}

function withoutQuality(args) {
  return args.filter((a) => !/^\d{3,4}p$/i.test(a));
}

function getCooldownRemaining(untilMs) {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}

function getYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "").trim();
    const v = u.searchParams.get("v");
    if (v) return v.trim();
    const parts = u.pathname.split("/").filter(Boolean);
    const idxShorts = parts.indexOf("shorts");
    if (idxShorts >= 0 && parts[idxShorts + 1]) return parts[idxShorts + 1].trim();
    const idxEmbed = parts.indexOf("embed");
    if (idxEmbed >= 0 && parts[idxEmbed + 1]) return parts[idxEmbed + 1].trim();
    return null;
  } catch {
    return null;
  }
}

function toAbsoluteUrl(urlLike) {
  if (!urlLike) return "";
  if (/^https?:\/\//i.test(urlLike)) return urlLike;
  return new URL(urlLike, API_BASE).href;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickUrl(data) {
  return (
    data?.result?.download_url_full ||
    data?.result?.download_url ||
    data?.result?.url ||
    data?.url ||
    ""
  );
}

async function requestVideoLink(url, quality, mode = "ytdl") {
  if (mode === "ytmp4link") {
    return axios.get(`${API_BASE}/ytmp4/link`, {
      timeout: 30000,
      params: { url, quality },
      validateStatus: (s) => s >= 200 && s < 500,
    });
  }

  return axios.get(API_URL, {
    timeout: 30000,
    params: {
      type: "video",
      url,
      quality,
      safe: true,
    },
    validateStatus: (s) => s >= 200 && s < 500,
  });
}

// ===== API (URL directa con reintentos + fallback) =====
async function fetchDirectMediaUrl({ videoUrl, quality }) {
  const qualities = [quality, "360p", "480p", "240p", "144p", "best"]
    .filter(Boolean)
    .map((q) => String(q).toLowerCase())
    .filter((q, i, arr) => arr.indexOf(q) === i);

  const strategies = ["ytdl", "ytmp4link"];
  let lastError = "No se pudo obtener URL directa.";

  for (let attempt = 1; attempt <= 2; attempt++) {
    for (const q of qualities) {
      for (const mode of strategies) {
        try {
          const { data } = await requestVideoLink(videoUrl, q, mode);

          if (data?.status === false) {
            lastError = data?.error?.message || data?.message || "status false";
            continue;
          }

          const candidate = pickUrl(data);
          if (!candidate) {
            lastError = "Respuesta sin URL de descarga.";
            continue;
          }

          return {
            title: data?.result?.title || data?.title || "video",
            directUrl: toAbsoluteUrl(candidate),
          };
        } catch (e) {
          lastError = e?.message || "request failed";
        }
      }
    }

    await sleep(900 * attempt);
  }

  throw new Error(lastError);
}

async function resolveVideoInfo(queryOrUrl) {
  // Si no es URL => búsqueda por texto
  if (!isHttpUrl(queryOrUrl)) {
    const search = await yts(queryOrUrl);
    const first = search?.videos?.[0];
    if (!first) return null;
    return {
      videoUrl: first.url,
      title: safeFileName(first.title),
      thumbnail: first.thumbnail || null,
    };
  }

  // Si es URL => intenta videoId para metadata más exacta
  const vid = getYoutubeId(queryOrUrl);
  if (vid) {
    try {
      const info = await yts({ videoId: vid });
      if (info) {
        return {
          videoUrl: info.url || queryOrUrl,
          title: safeFileName(info.title),
          thumbnail: info.thumbnail || null,
        };
      }
    } catch {}
  }

  // fallback
  try {
    const search = await yts(queryOrUrl);
    const first = search?.videos?.[0];
    if (first) {
      return {
        videoUrl: first.url || queryOrUrl,
        title: safeFileName(first.title),
        thumbnail: first.thumbnail || null,
      };
    }
  } catch {}

  return { videoUrl: queryOrUrl, title: "video", thumbnail: null };
}

/**
 * Intenta enviar por URL como video.
 * Si falla, intenta como documento por URL.
 * (Sin disco => sin ENOSPC)
 */
async function sendByUrl(sock, from, quoted, { directUrl, title }) {
  // 1) video
  try {
    await sock.sendMessage(
      from,
      {
        video: { url: directUrl },
        mimetype: "video/mp4",
        caption: `🎬 ${title}`,
        ...global.channelInfo,
      },
      quoted
    );
    return "video";
  } catch (e1) {
    console.error("send video by url failed:", e1?.message || e1);

    // 2) documento
    await sock.sendMessage(
      from,
      {
        document: { url: directUrl },
        mimetype: "video/mp4",
        fileName: `${title}.mp4`,
        caption: `📄 Enviado como documento\n🎬 ${title}`,
        ...global.channelInfo,
      },
      quoted
    );
    return "document";
  }
}

export default {
  command: ["ytmp4"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;

    const userId = from;

    // ===== COOLDOWN =====
    const until = cooldowns.get(userId);
    if (until && until > Date.now()) {
      return sock.sendMessage(from, {
        text: `⏳ Espera ${getCooldownRemaining(until)}s`,
        ...global.channelInfo,
      });
    }
    cooldowns.set(userId, Date.now() + COOLDOWN_TIME);

    const quoted = msg?.key ? { quoted: msg } : undefined;

    try {
      if (!args?.length) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text: "❌ Uso: .ytmp4 (360p) <nombre o link>",
          ...global.channelInfo,
        });
      }

      const quality = parseQuality(args);
      const query = withoutQuality(args).join(" ").trim();
      if (!query) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text: "❌ Debes poner un nombre o link.",
          ...global.channelInfo,
        });
      }

      // ===== Buscar metadata + URL =====
      const meta = await resolveVideoInfo(query);
      if (!meta) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text: "❌ No se encontró el video.",
          ...global.channelInfo,
        });
      }

      let { videoUrl, title, thumbnail } = meta;

      // ===== Mensaje previo =====
      if (thumbnail) {
        await sock.sendMessage(
          from,
          {
            image: { url: thumbnail },
            caption: `⬇️ Preparando envío...\n\n🎬 ${title}\n🎚️ Calidad: ${quality}\n⏳ Espera por favor...`,
            ...global.channelInfo,
          },
          quoted
        );
      } else {
        await sock.sendMessage(
          from,
          {
            text: `⬇️ Preparando envío...\n\n🎬 ${title}\n🎚️ Calidad: ${quality}\n⏳ Espera por favor...`,
            ...global.channelInfo,
          },
          quoted
        );
      }

      // ===== API URL directa =====
      const info = await fetchDirectMediaUrl({ videoUrl, quality });
      title = safeFileName(info.title || title);

      // ===== Enviar SIN DISCO =====
      await sendByUrl(sock, from, quoted, { directUrl: info.directUrl, title });
    } catch (err) {
      console.error("YTMP4 ERROR:", err?.message || err);
      cooldowns.delete(userId);

      const msgErr = String(err?.message || "Error al procesar el video.").trim();

      await sock.sendMessage(from, {
        text: `❌ ${msgErr}`,
        ...global.channelInfo,
      });
    }
  },
};

