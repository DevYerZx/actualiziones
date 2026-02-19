import fs from "fs";
import path from "path";

const VIP_FILE = path.join(process.cwd(), "settings", "vip.json");

function readVip() {
  try {
    const raw = fs.readFileSync(VIP_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!data.users || typeof data.users !== "object") data.users = {};
    return data;
  } catch {
    return { users: {} };
  }
}

function saveVip(data) {
  try {
    fs.writeFileSync(VIP_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function normalizeNumber(x) {
  return String(x || "").replace(/[^\d]/g, "").trim();
}

function getSenderNumber(msg, from) {
  const jid = msg?.key?.participant || from;
  return String(jid || "").split("@")[0];
}

function isOwner(senderNumber, settings) {
  const owners = Array.isArray(settings?.ownerNumbers)
    ? settings.ownerNumbers
    : (typeof settings?.ownerNumber === "string" ? [settings.ownerNumber] : []);

  const sender = normalizeNumber(senderNumber);
  return owners.map(normalizeNumber).includes(sender);
}

/**
 * ✅ Verifica VIP y descuenta 1 uso
 * - Owner: ilimitado (no revisa vencimiento ni usos)
 * - VIP: revisa expiresAt y usesLeft
 */
export function checkVipAndConsume({ msg, from, settings }) {
  const sender = normalizeNumber(getSenderNumber(msg, from));

  // 👑 OWNER = ILIMITADO
  if (isOwner(sender, settings)) {
    return { ok: true, owner: true, unlimited: true };
  }

  const data = readVip();
  const info = data.users[sender];

  if (!info) return { ok: false, reason: "no_vip" };

  const now = Date.now();

  // ⏳ vencido
  if (typeof info.expiresAt === "number" && now >= info.expiresAt) {
    delete data.users[sender];
    saveVip(data);
    return { ok: false, reason: "expired" };
  }

  // 🎟️ usos
  if (typeof info.usesLeft === "number") {
    if (info.usesLeft <= 0) {
      delete data.users[sender];
      saveVip(data);
      return { ok: false, reason: "limit" };
    }

    // consumir 1 uso
    info.usesLeft -= 1;
    data.users[sender] = info;
    saveVip(data);
  }

  return {
    ok: true,
    owner: false,
    usesLeft: info.usesLeft,
    expiresAt: info.expiresAt,
  };
}

