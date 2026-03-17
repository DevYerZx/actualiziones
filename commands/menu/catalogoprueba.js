import { getPrefix } from "../sistema/_shared.js";

export default {
  name: "catalogoprueba",
  command: ["catalogoprueba", "catalogotest", "menulista"],
  category: "menu",
  description: "Envia un menu tipo catalogo para probar listas de WhatsApp",

  run: async ({ sock, msg, from, settings }) => {
    const prefix = getPrefix(settings);
    const now = new Date().toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const text =
      "MENU PRINCIPAL\n" +
      "[ MENU ]\n" +
      "LABORATORIO DE COMANDOS\n" +
      `Bot: ${settings?.botName || "DVYER"}\n` +
      `Hora: ${now}\n\n` +
      "Elige una categoria";

    return sock.sendMessage(
      from,
      {
        text,
        footer: "Categorias",
        title: "Menu principal",
        buttonText: "Abrir catalogo",
        sections: [
          {
            title: "Comandos",
            rows: [
              {
                title: "Menu completo",
                description: "Muestra todos los comandos",
                rowId: `${prefix}menu`,
              },
              {
                title: "Categoria: sistema",
                description: "Ver prueba de categoria sistema",
                rowId: `${prefix}catprueba sistema`,
              },
              {
                title: "Categoria: descargas",
                description: "Ver prueba de categoria descargas",
                rowId: `${prefix}catprueba descargas`,
              },
              {
                title: "Categoria: juegos",
                description: "Ver prueba de categoria juegos",
                rowId: `${prefix}catprueba juegos`,
              },
            ],
          },
          {
            title: "Accesos rapidos",
            rows: [
              {
                title: "Ping",
                description: "Prueba rapida del bot",
                rowId: `${prefix}ping`,
              },
              {
                title: "Prueba de catalogo",
                description: "Confirma que la lista funciona",
                rowId: `${prefix}catalogook`,
              },
            ],
          },
        ],
      },
      { quoted: msg }
    );
  },
};
