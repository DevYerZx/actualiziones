import { getPrefix } from "../sistema/_shared.js";

export default {
  name: "catalogook",
  command: ["catalogook", "catprueba", "listook"],
  category: "menu",
  description: "Responde a las selecciones del catalogo de prueba",

  run: async ({ sock, msg, from, args = [], settings, botLabel }) => {
    const prefix = getPrefix(settings);
    const selected = String(args[0] || "prueba").trim().toLowerCase();
    const label = String(botLabel || settings?.botName || "BOT").toUpperCase();

    const categoryMap = {
      sistema: `${prefix}ping, ${prefix}status, ${prefix}sysinfo`,
      descargas: `${prefix}ytmp3, ${prefix}ytmp4, ${prefix}spotify`,
      juegos: `${prefix}juegos, ${prefix}ppt, ${prefix}trivia`,
      prueba: `${prefix}catalogoprueba`,
    };

    const sample = categoryMap[selected] || categoryMap.prueba;

    return sock.sendMessage(
      from,
      {
        text:
          `Catalogo funcionando correctamente.\n\n` +
          `Bot activo: ${label}\n` +
          `Seleccion: ${selected}\n` +
          `Ejemplos: ${sample}\n\n` +
          `Para volver a abrirlo usa: ${prefix}catalogoprueba`,
      },
      { quoted: msg }
    );
  },
};
