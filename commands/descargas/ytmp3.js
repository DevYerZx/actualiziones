import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const API_BASE = "https://dv-yer-api.online/ytmp3";
const TMP_DIR = path.join(process.cwd(), "tmp");

// Asegurar que la carpeta temporal exista
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

export default {
  command: ["ytmp3", "play"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const messageKey = msg?.key || null;
    
    // Generar nombre de archivo único para evitar conflictos
    const fileName = `audio_${Date.now()}.mp3`;
    const outputPath = path.join(TMP_DIR, fileName);

    try {
      if (!args?.length) return;
      if (messageKey) await sock.sendMessage(from, { react: { text: "⏳", key: messageKey } });

      let query = args.join(" ").trim();
      let videoUrl = query;
      if (!/^https?:\/\//i.test(query)) {
        const { videos } = await yts(query);
        videoUrl = videos[0].url;
      }

      // 1. Obtener URL de la API
      const apiRes = await axios.get(API_BASE, {
        params: { mode: "link", quality: "128k", url: videoUrl }
      });
      
      const streamUrl = apiRes.data?.download_url_full;
      if (!streamUrl) throw new Error("API no respondió.");

      // 2. Descargar y convertir usando ffmpeg directamente al archivo local
      await new Promise((resolve, reject) => {
        // Comando ffmpeg que descarga de la URL y guarda en el archivo temporal
        const cmd = `ffmpeg -i "${streamUrl}" -vn -acodec libmp3lame -q:a 2 "${outputPath}"`;
        exec(cmd, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // 3. Enviar el archivo físico desde el servidor a WhatsApp
      await sock.sendMessage(from, {
        audio: { url: outputPath },
        mimetype: "audio/mpeg",
        ptt: true, // Nota de voz
        fileName: "audio.mp3"
      }, { quoted: msg });

      if (messageKey) await sock.sendMessage(from, { react: { text: "✅", key: messageKey } });

    } catch (err) {
      console.error("❌ ERROR:", err);
      if (messageKey) await sock.sendMessage(from, { react: { text: "❌", key: messageKey } });
    } finally {
      // 4. Limpiar archivo temporal
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  },
};
