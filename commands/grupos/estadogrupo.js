import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "database");

function safeJsonParse(raw) {
  try {
    const a = JSON.parse(raw);
    if (typeof a === "string") return JSON.parse(a); // por si quedó "[]"
    return a;
  } catch {
    return null;
  }
}

function readSetFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return new Set();
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = safeJsonParse(raw);
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

function onOff(v) {
  return v ? "ON ✅" : "OFF ❌";
}

export default {
  command: ["estadogrupo", "configgrupo", "gpstatus"],
  category: "grupo",
  description: "Muestra funciones activas del grupo (solo admins)",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from }) => {
    // Archivos (si alguno no existe, lo toma como OFF)
    const welcomeFile = path.join(DB_DIR, "welcome.json");
    const modoAdmiFile = path.join(DB_DIR, "modoadmi.json");
    const antilinkFile = path.join(DB_DIR, "antilink.json"); // si usas persistente
    const antispamFile = path.join(DB_DIR, "antispam.json"); // persistente

    const welcomeSet = readSetFromFile(welcomeFile);
    const modoAdmiSet = readSetFromFile(modoAdmiFile);
    const antilinkSet = readSetFromFile(antilinkFile);
    const antispamSet = readSetFromFile(antispamFile);

    const welcomeOn = welcomeSet.has(from);
    const modoAdmiOn = modoAdmiSet.has(from);

    const antilinkExists = fs.existsSync(antilinkFile);
    const antilinkLabel = antilinkExists
      ? onOff(antilinkSet.has(from))
      : "TEMP ♻️ (no guardado)";

    const antispamOn = antispamSet.has(from);

    const caption =
      `🧩 *ESTADO DEL GRUPO*\n\n` +
      `• Welcome: ${onOff(welcomeOn)}\n` +
      `• ModoAdmin: ${onOff(modoAdmiOn)}\n` +
      `• Antilink: ${antilinkLabel}\n` +
      `• Antispam: ${onOff(antispamOn)}\n\n` +
      `👮 Solo admins pueden usar este comando.`;

    // Intentar obtener la foto del grupo y enviarla
    try {
      const ppUrl = await sock.profilePictureUrl(from, "image"); // group pp
      return sock.sendMessage(
        from,
        { image: { url: ppUrl }, caption, ...global.channelInfo },
        { quoted: msg }
      );
    } catch (e) {
      // Si el grupo no tiene foto o WA bloquea el acceso, manda solo texto
      return sock.sendMessage(
        from,
        { text: caption, ...global.channelInfo },
        { quoted: msg }
      );
    }
  }
};
