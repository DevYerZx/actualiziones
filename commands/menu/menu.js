import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⏱️ uptime bonito
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// 🎨 Emojis por categoría
const CAT_ICON = {
  menu: "📜",
  music: "🎵",
  descarga: "📥",
  grupos: "👥",
  admin: "🛡️",
  juegos: "🎮",
  tools: "🧰",
  fun: "😄",
  default: "✨",
};

function getCatIcon(cat) {
  return CAT_ICON[cat] || CAT_ICON.default;
}

// Normaliza texto
function norm(s) {
  return String(s || "").trim().toLowerCase();
}

// Construye la estructura { cat -> Set(comandos) }
function buildCategories(comandos) {
  const categorias = new Map();

  for (const cmd of new Set(comandos.values())) {
    if (!cmd?.category || !cmd?.command) continue;

    const cat = norm(cmd.category) || "otros";
    const names = Array.isArray(cmd.command) ? cmd.command : [cmd.command];

    if (!categorias.has(cat)) categorias.set(cat, new Set());
    const set = categorias.get(cat);

    for (const n of names) {
      const name = norm(n);
      if (!name) continue;
      set.add(name);
    }
  }

  return categorias;
}

function buildHeader({ botName, prefix, uptime, totalCats, totalCmds }) {
  return (
    `╭══════════════════════╮\n` +
    `│ ✦ *${botName}* ✦\n` +
    `╰══════════════════════╯\n\n` +
    `▸ _prefijo_ : *${prefix}*\n` +
    `▸ _estado_  : *online*\n` +
    `▸ _uptime_  : *${uptime}*\n` +
    `▸ _categorías_ : *${totalCats}*\n` +
    `▸ _comandos_   : *${totalCmds}*\n\n` +
    `┌──────────────────────┐\n` +
    `│ ✧ *MENÚ DE COMANDOS* ✧\n` +
    `└──────────────────────┘\n`
  );
}

function buildFooter(prefix) {
  return (
    `\n┌──────────────────────┐\n` +
    `│ ✦ _bot premium activo_ ✦\n` +
    `└──────────────────────┘\n` +
    `💡 Tips:\n` +
    `• *${prefix}menu music*  (solo música)\n` +
    `• *${prefix}menu all*    (todo completo)\n` +
    `• *${prefix}play <texto>* (buscar y descargar)\n` +
    `_artoria bot vip_\n`
  );
}

function buildCategoryBlock({ cat, cmds, prefix, maxPerCat }) {
  const icon = getCatIcon(cat);
  const sorted = [...cmds].sort();
  const total = sorted.length;

  let block =
    `\n╭─ ${icon} *${cat.toUpperCase()}*  _(${total})_\n` +
    `│`;

  const shown = maxPerCat ? sorted.slice(0, maxPerCat) : sorted;

  for (const c of shown) {
    block += `\n│  • \`${prefix}${c}\``;
  }

  if (maxPerCat && total > maxPerCat) {
    block += `\n│  • … y *${total - maxPerCat}* más`;
  }

  block += `\n╰──────────────────────`;
  return block;
}

export default {
  command: ["menu"],
  category: "menu",
  description: "Menú principal con diseño premium",

  run: async ({ sock, msg, from, settings, comandos, args = [] }) => {
    try {
      if (!sock || !from) return;
      if (!comandos) {
        return sock.sendMessage(from, { text: "❌ error interno" }, { quoted: msg });
      }

      const botName = settings?.botName || "DVYER BOT";
      const prefix = settings?.prefix || ".";
      const uptime = formatUptime(process.uptime());

      // 🎥 video menú
      const videoPath = path.join(process.cwd(), "videos", "menu-video.mp4");
      const hasVideo = fs.existsSync(videoPath);

      // 📂 armar categorías
      const categorias = buildCategories(comandos);
      const catsSorted = [...categorias.keys()].sort();

      // totals
      let totalCmds = 0;
      for (const set of categorias.values()) totalCmds += set.size;

      // 🔎 modo de menú
      const arg = norm(args?.[0] || "");
      const showAll = arg === "all";
      const filterCat = arg && arg !== "all" ? arg : null;

      // Si pidió una categoría específica y no existe:
      if (filterCat && !categorias.has(filterCat)) {
        const available = catsSorted.slice(0, 12).map(c => `${getCatIcon(c)} ${c}`).join(", ");
        return sock.sendMessage(
          from,
          {
            text:
              headerBox("MENU") +
              `\n\n⚠️ Categoría no encontrada: *${filterCat}*\n\n` +
              `✅ Ejemplos:\n` +
              `• ${prefix}menu music\n` +
              `• ${prefix}menu descarga\n` +
              `• ${prefix}menu all\n\n` +
              `📂 Disponibles: ${available}` +
              (catsSorted.length > 12 ? " …" : ""),
          },
          { quoted: msg }
        );
      }

      // ✅ construir menú
      const totalCats = catsSorted.length;
      let menu = buildHeader({ botName, prefix, uptime, totalCats, totalCmds });

      const MAX_PER_CAT = showAll ? null : 6;

      if (filterCat) {
        // solo una categoría
        menu += buildCategoryBlock({
          cat: filterCat,
          cmds: categorias.get(filterCat),
          prefix,
          maxPerCat: null, // en vista por categoría: muestro TODO
        });
      } else {
        // menú general
        for (const cat of catsSorted) {
          menu += buildCategoryBlock({
            cat,
            cmds: categorias.get(cat),
            prefix,
            maxPerCat: MAX_PER_CAT,
          });
        }
      }

      menu += buildFooter(prefix);

      // 🚀 Enviar (video si existe, si no texto)
      if (hasVideo) {
        await sock.sendMessage(
          from,
          {
            video: fs.createReadStream(videoPath),
            mimetype: "video/mp4",
            gifPlayback: true,
            caption: menu.trim(),
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(from, { text: menu.trim() }, { quoted: msg });
      }
    } catch (err) {
      console.error("MENU ERROR:", err);
      await sock.sendMessage(from, { text: "❌ err
