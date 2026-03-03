import axios from "axios";

export default {
  name: "ytmp4",
  command: ["yt2"],
  category: "descarga",
  desc: "Descarga videos de YouTube en calidad 360p",

  run: async ({ sock, msg, from, args, settings }) => {

    const url = args[0];

    if (!url) {
      return sock.sendMessage(
        from,
        {
          text:
`╭─❍ *USO CORRECTO* ❍
│
│ ${settings.prefix}ytmp4 <link youtube>
│
│ Ejemplo:
│ ${settings.prefix}ytmp4 https://youtu.be/xxxxx
╰───────────────`,
          ...global.channelInfo
        },
        { quoted: msg }
      );
    }

    try {

      await sock.sendMessage(
        from,
        { text: "⏳ Descargando video, espera un momento...", ...global.channelInfo },
        { quoted: msg }
      );

      const api = `https://nexevo.onrender.com/download/y2?url=${encodeURIComponent(url)}`;

      const { data } = await axios.get(api);

      if (!data?.status || !data?.result?.status) {
        return sock.sendMessage(
          from,
          { text: "❌ No se pudo descargar el video.", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const video = data.result;
      const info = video.info || {};

      const title = info.title || "Video de YouTube";
      const thumbnail = info.thumbnail;
      const quality = video.quality || 360;

      // 📌 Enviar thumbnail primero
      if (thumbnail) {
        await sock.sendMessage(
          from,
          {
            image: { url: thumbnail },
            caption:
`╭─❍ *YOUTUBE DOWNLOADER* ❍
│ 🎬 Título: ${title}
│ 📺 Calidad: ${quality}p
│ 🆔 ID: ${video.videoId}
╰───────────────`,
            ...global.channelInfo
          },
          { quoted: msg }
        );
      }

      // 🎥 Enviar video
      await sock.sendMessage(
        from,
        {
          video: { url: video.url },
          caption: `✅ Aquí tienes tu video en ${quality}p`,
          ...global.channelInfo
        },
        { quoted: msg }
      );

    } catch (e) {

      console.error("Error en ytmp4:", e);

      await sock.sendMessage(
        from,
        {
          text: "❌ Error al conectar con la API.",
          ...global.channelInfo
        },
        { quoted: msg }
      );
    }
  }
};