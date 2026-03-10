import fs from "fs";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { exec } from "child_process";

const API_BASE = "https://dv-yer-api.online";
const COOLDOWN_TIME = 10 * 1000;
const TMP_DIR = path.join(process.cwd(), "tmp");
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

const cooldowns = new Map();

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function safeFileName(name) {
  return String(name || "audio").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// Función para obtener URL según el comando
async function getDownloadUrl(videoUrl, type) {
  const endpoint = type === "ytmp4" ? `${API_BASE}/ytmp4` : `${API_BASE}/ytmp3`;
  const response = await axios.get(endpoint, {
    params: { url: videoUrl, mode: "link", quality: "128k" },
    timeout: 35000
  });
  
  const data = response.data;
  return data?.download_url_full || data?.result?.download_url_full;
}

// Conversión forzada a MP3 usando FFmpeg
async function convertToMp3(inputUrl, outputPath) {
  return new Promise((resolve, reject) => {
    // -i: entrada, -vn: quitar video, -acodec libmp3lame: convertir a MP3
    const cmd = `ffmpeg -y -i "${inputUrl}" -vn -acodec libmp3lame -ab 128k -ar 44100 "${outputPath}"`;
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

export default {
  command: ["ytmp3", "play"], 
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args, command } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const userId = from;
    let finalMp3;

    if (cooldowns.has(userId) && cooldowns.get(userId) > Date.now()) return;
    cooldowns.set(userId, Date.now() + COOLDOWN_TIME);

    try {
      if (!args?.length) throw new Error("Uso: ." + command + " <nombre o link>");
      
      const query = args.join(" ").trim();
      let videoUrl = query;
      let title = "Audio";

      if (!/^https?:\/\//i.test(query)) {
        const search = await yts(query);
        if (!search.videos.length) throw new Error("No encontrado");
        videoUrl = search.videos[0].url;
        title = search.videos[0].title;
      }

      finalMp3 = path.join(TMP_DIR, `${Date.now()}.mp3`);
      
      // 1. Obtener URL desde la API (independientemente si es ytmp3 o ytmp4)
      const downloadUrl = await getDownloadUrl(videoUrl, command);
      
      // 2. Convertir/Descargar a MP3 vía FFmpeg
      await convertToMp3(downloadUrl, finalMp3);

      // 3. Validar tamaño
      const size = fs.existsSync(finalMp3) ? fs.statSync(finalMp3).size : 0;
      if (size > MAX_AUDIO_BYTES) throw new Error("Archivo demasiado pesado.");

      // 4. Enviar como música
      await sock.sendMessage(from, {
        audio: { url: finalMp3 },
        mimetype: "audio/mpeg",
        fileName: `${safeFileName(title)}.mp3`,
        ...global.channelInfo
      }, { quoted: msg });

    } catch (err) {
      console.error("ERROR:", err.message);
      await sock.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: msg });
    } finally {
      if (finalMp3 && fs.existsSync(finalMp3)) fs.unlinkSync(finalMp3);
    }
  },
};
