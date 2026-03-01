export default {
  command: ["tagall"],
  category: "grupo",
  description: "Etiqueta a todos",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const meta = await sock.groupMetadata(from);
    const members = meta.participants.map((p) => p.id);

    const texto = args.length
      ? args.join(" ")
      : "📣 *Tagall*";

    const lines = meta.participants
      .map((p) => `• @${p.id.split("@")[0]}`)
      .join("\n");

    return sock.sendMessage(
      from,
      {
        text: `${texto}\n\n${lines}`,
        mentions: members,
        ...global.channelInfo
      },
      { quoted: msg }
    );
  }
};
