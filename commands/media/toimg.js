import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import pino from "pino";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const logger = pino({ level: "silent" });
const TMP_DIR = path.join(process.cwd(), "tmp");

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

function randName(ext) {
  return `${Date.now()}_${Math.floor(Math.random() * 99999)}.${ext}`;
}

function buildQuotedWAMessage(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (!quoted) return null;

  return {
    key: {
      remoteJid: msg.key.remoteJid,
      fromMe: false,
      id: ctx.stanzaId,
      participant: ctx.participant,
    },
    message: quoted,
  };
}

function webpToPng(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .toFormat("png")
      .on("end", resolve)
      .on("error", reject)
      .save(output);
  });
}

export default {
  command: ["toimg", "img"],
  category: "media",
  description: "Sticker a imagen",

  run: async ({ sock, msg, from }) => {
    try {
      ensureTmp();

      const quotedMsg = buildQuotedWAMessage(msg);
      if (!quotedMsg?.message?.stickerMessage) {
        return sock.sendMessage(
          from,
          { text: "⚙️ Responde a un *sticker* con .toimg", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const buff = await downloadMediaMessage(
        quotedMsg,
        "buffer",
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      );

      const inFile = path.join(TMP_DIR, randName("webp"));
      const outFile = path.join(TMP_DIR, randName("png"));

      fs.writeFileSync(inFile, buff);
      await webpToPng(inFile, outFile);

      const png = fs.readFileSync(outFile);
      fs.unlinkSync(inFile);
      fs.unlinkSync(outFile);

      return sock.sendMessage(
        from,
        { image: png, caption: "✅ Convertido a imagen.", ...global.channelInfo },
        { quoted: msg }
      );
    } catch (e) {
      console.error("toimg error:", e);

      const tip = String(e?.message || "").toLowerCase().includes("ffmpeg")
        ? "\n\n💡 *Solución:* instala ffmpeg en tu VPS/PC."
        : "";

      return sock.sendMessage(
        from,
        { text: `❌ Error convirtiendo sticker.${tip}`, ...global.channelInfo },
        { quoted: msg }
      );
    }
  }
};
