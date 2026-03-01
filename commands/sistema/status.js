import fs from "fs";
import path from "path";

function safeJsonParse(raw) {
  try {
    const a = JSON.parse(raw);
    // en tu repo hay JSONs que quedaron como string "[]"
    if (typeof a === "string") return JSON.parse(a);
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
    if (Array.isArray(data)) return new Set(data);
    return new Set();
  } catch {
    return new Set();
  }
}

function formatUptime(seconds) {
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function getPrefixLabel(settings) {
  const noPrefix = settings?.noPrefix === true;
  const p = settings?.prefix;

  if (noPrefix) return "SIN PREFIJO";

  if (Array.isArray(p) && p.length) return p.join(" | ");
  if (typeof p === "string" && p.trim()) return p.trim();

  return "SIN PREFIJO";
}

export default {
  name: "status",
  command: ["status", "estado"],
  category: "sistema",
  description: "Panel de estado del bot",

  run: async ({ sock, msg, from, settings, comandos, esGrupo }) => {
    const DB_DIR = path.join(process.cwd(), "database");
    const welcomeFile = path.join(DB_DIR, "welcome.json");
    const modoAdmiFile = path.join(DB_DIR, "modoadmi.json");
    const antilinkFile = path.join(DB_DIR, "antilink.json"); // (solo si aplicas el parche opcional)

    const welcomeSet = readSetFromFile(welcomeFile);
    const modoAdmiSet = readSetFromFile(modoAdmiFile);
    const antilinkSet = readSetFromFile(antilinkFile);

    const welcomeOn = welcomeSet.has(from);
    const modoAdmiOn = modoAdmiSet.has(from);

    // antilink: si no existe archivo, tu bot lo usa temporal → mostramos "TEMP"
    const antilinkExists = fs.existsSync(antilinkFile);
    const antilinkLabel = antilinkExists
      ? (antilinkSet.has(from) ? "ON ✅" : "OFF ❌")
      : "TEMP ♻️ (se reinicia)";

    // VIP users
    const vipFile = path.join(process.cwd(), "settings", "vip.json");
    let vipCount = 0;
    try {
      if (fs.existsSync(vipFile)) {
        const raw = fs.readFileSync(vipFile, "utf-8");
        const data = safeJsonParse(raw) || {};
        const users = data.users && typeof data.users === "object" ? data.users : {};
        vipCount = Object.keys(users).length;
      }
    } catch {}

    const prefixLabel = getPrefixLabel(settings);
    const newsletterOn = !!settings?.newsletter?.enabled;

    const texto =
`📊 *STATUS - ${settings.botName || "BOT"}*

⚙️ *Prefijo:* ${prefixLabel}
📰 *Newsletter:* ${newsletterOn ? "ON ✅" : "OFF ❌"}
🧩 *Comandos cargados:* ${comandos?.size ?? "?"}
⏱️ *Uptime:* ${formatUptime(process.uptime())}
👑 *Owner:* ${settings.ownerName || "Owner"}
💎 *VIP users:* ${vipCount}

${esGrupo ? `👥 *Grupo:*
• Welcome: ${welcomeOn ? "ON ✅" : "OFF ❌"}
• ModoAdmin: ${modoAdmiOn ? "ON ✅" : "OFF ❌"}
• Antilink: ${antilinkLabel}` : "📩 *Chat privado:* (config de grupo no aplica)"}`
;

    return sock.sendMessage(
      from,
      { text: texto, ...global.channelInfo },
      { quoted: msg }
    );
  }
};
