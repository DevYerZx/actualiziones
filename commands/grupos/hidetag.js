export default {
  command: ["hidetag"],
  category: "grupo",
  description: "Etiqueta a todos sin listar",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const meta = await sock.groupMetadata(from);
    const members = meta.participants.map((p) => p.id);

    const texto = args.length
      ? args.join(" ")
      : "ㅤ"; // invisible

    return sock.sendMessage(
      from,
      { text: texto, mentions: members, ...global.channelInfo },
      { quoted: msg }
    );
  }
};
