import fs from "fs";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { exec } from "child_process";

const API_URL = "https://mayapi.ooguy.com/ytdl";

// ROTACIÓN API
const API_KEYS = [
  "may-08988cc0",
  "may-ddfb7860",
  "may-ea9fd2d2",
  "may-9030a982"
];

let apiIndex = 0;

function getNextApiKey() {
  const key = API_KEYS[apiIndex];
  apiIndex = (apiIndex + 1) % API_KEYS.length;
  return key;
}

const COOLDOWN_TIME = 10 * 1000;
const TMP_DIR = path.join(process.cwd(), "tmp");

const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const MIN_AUDIO_BYTES = 100000;

const CLEANUP_TIME = 2 * 60 * 60 * 1000;

const cooldowns = new Map();
const locks = new Set();

const channelInfo = global.channelInfo || {};

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function safeFileName(name) {
  return String(name || "audio")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

// limpiar tmp
function cleanupTmp() {
  try {
    const now = Date.now();

    for (const file of fs.readdirSync(TMP_DIR)) {
      const p = path.join(TMP_DIR, file);
      const st = fs.statSync(p);

      if (st.isFile() && now - st.mtimeMs > CLEANUP_TIME) {
        fs.unlinkSync(p);
      }
    }
  } catch {}
}

// obtener media desde api
async function fetchDirectMediaUrl(videoUrl) {

  let lastError;

  for (let i = 0; i < API_KEYS.length; i++) {

    const key = getNextApiKey();

    try {

      const { data } = await axios.get(API_URL, {
        timeout: 25000,
        params: {
          url: videoUrl,
          quality: "128",
          apikey: key
        },
        validateStatus: s => s >= 200 && s < 500
      });

      if (data?.status && data?.result?.url) {

        return {
          title: data.result.title || "audio",
          directUrl: data.result.url
        };

      }

      lastError = new Error("API sin URL");

    } catch (err) {
      lastError = err;
    }

  }

  throw new Error(lastError?.message || "Todas las API fallaron");
}

// convertir mp3
async function convertToMp3(inputUrl, output) {

  return new Promise((resolve, reject) => {

    const cmd = `ffmpeg -y -headers "User-Agent: Mozilla/5.0\\r\\nReferer: https://www.youtube.com/\\r\\nOrigin: https://www.youtube.com\\r\\n" -i "${inputUrl}" -vn -ar 44100 -ac 2 -b:a 128k -loglevel error "${output}"`;

    exec(cmd, (err) => {
      if (err) reject(err);
      else resolve();
    });

  });

}

// buscar video
async function resolveVideo(query) {

  if (isHttpUrl(query)) {

    const search = await yts(query);

    const first = search?.videos?.[0];

    if (first?.seconds > 1800) {
      throw new Error("Video demasiado largo (máx 30 min)");
    }

    return {
      url: query,
      title: first?.title || "audio",
      thumbnail: first?.thumbnail || null
    };

  }

  const search = await yts(query);

  const first = search?.videos?.[0];

  if (!first) return null;

  if (first.seconds > 1800) {
    throw new Error("Video demasiado largo (máx 30 min)");
  }

  return {
    url: first.url,
    title: first.title,
    thumbnail: first.thumbnail
  };

}

export default {

  command: ["ytmp3", "play", "yt1"],
  category: "descarga",

  run: async (ctx) => {

    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg;

    const userId = from;

    if (locks.has(from)) {

      return sock.sendMessage(from,{
        text:"⏳ Ya estoy descargando otra música.",
        ...channelInfo
      });

    }

    const until = cooldowns.get(userId);

    if (until && until > Date.now()) {

      return sock.sendMessage(from,{
        text:`⏳ Espera ${Math.ceil((until-Date.now())/1000)}s`,
        ...channelInfo
      });

    }

    cooldowns.set(userId,Date.now()+COOLDOWN_TIME);

    let finalMp3;

    const quoted = msg?.key ? { quoted: msg } : undefined;

    try {

      locks.add(from);

      cleanupTmp();

      if (!args?.length) {

        cooldowns.delete(userId);

        return sock.sendMessage(from,{
          text:"❌ Uso: .play <nombre o link>\n❌ Uso: .ytmp3 <nombre o link>",
          ...channelInfo
        });

      }

      const query = args.join(" ").trim();

      const meta = await resolveVideo(query);

      if (!meta) {

        cooldowns.delete(userId);

        return sock.sendMessage(from,{
          text:"❌ No se encontró la música.",
          ...channelInfo
        });

      }

      let { url, title, thumbnail } = meta;

      title = safeFileName(title);

      await sock.sendMessage(from,{
        image: thumbnail ? { url: thumbnail } : undefined,
        caption:`🎵 Descargando música...\n\n🎧 ${title}`,
        ...channelInfo
      },quoted);

      const info = await fetchDirectMediaUrl(url);

      finalMp3 = path.join(TMP_DIR,`${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);

      await convertToMp3(info.directUrl,finalMp3);

      const size = fs.existsSync(finalMp3)
        ? fs.statSync(finalMp3).size
        : 0;

      if (!size || size < MIN_AUDIO_BYTES)
        throw new Error("Audio inválido");

      if (size > MAX_AUDIO_BYTES)
        throw new Error("Audio demasiado grande");

      await sock.sendMessage(from,{
        audio:{ url: finalMp3 },
        mimetype:"audio/mpeg",
        fileName:`${title}.mp3`,
        ptt:false,
        ...channelInfo
      },quoted);

    } catch(err){

      console.error("YTMP3 ERROR:",err?.message || err);

      cooldowns.delete(userId);

      await sock.sendMessage(from,{
        text:"❌ Error al descargar la música.",
        ...channelInfo
      });

    } finally {

      locks.delete(from);

      try{
        if(finalMp3 && fs.existsSync(finalMp3)){
          fs.unlinkSync(finalMp3);
        }
      }catch{}

    }

  }

};
