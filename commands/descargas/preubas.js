export default {
  command: ["inicio", "start", "menu", "ayuda"],
  category: "menu",

  run: async (ctx) => {
    const { sock, from, msg, settings } = ctx;
    const quoted = msg?.key ? { quoted: msg } : undefined;

    const usedPrefix = (() => {
      const p = settings?.prefix;
      if (settings?.noPrefix === true) return ".";
      if (Array.isArray(p)) return p[0] || ".";
      if (typeof p === "string") return p || ".";
      return ".";
    })();

    // 1) Intentar botones
    try {
      await sock.sendMessage(
        from,
        {
          text: "👋 *Bienvenido*\nElige una opción:",
          footer: settings?.botName || "DVYER BOT",
          buttons: [
            {
              buttonId: `${usedPrefix}hosting`,
              buttonText: { displayText: "🤖 TENER BOT / HOSTING" },
              type: 1,
            },
            {
              buttonId: `${usedPrefix}grupos`,
              buttonText: { displayText: "📢 GRUPOS OFICIALES" },
              type: 1,
            },
          ],
          headerType: 1,
        },
        quoted
      );

      // Si tu WhatsApp no los muestra, al menos no rompe nada.
      // Opcional: puedes mandar también la lista abajo siempre.
      return;
    } catch (e) {
      console.error("Botones fallaron, uso lista:", e?.message || e);
    }

    // 2) Fallback: lista por categorías (casi siempre funciona)
    return global.enviarLista(sock, from, {
      title: "📂 MENÚ PRINCIPAL",
      text: "Elige una opción:",
      footer: settings?.botName || "DVYER BOT",
      buttonText: "Abrir opciones",
      sections: [
        {
          title: "📌 Principal",
          rows: [
            {
              title: "🤖 TENER BOT / HOSTING",
              description: "Info para obtener bot/hosting",
              rowId: `${usedPrefix}hosting`,
            },
            {
              title: "📢 GRUPOS OFICIALES",
              description: "Lista de grupos oficiales",
              rowId: `${usedPrefix}grupos`,
            },
          ],
        },
      ],
      quoted,
    });
  },
};
