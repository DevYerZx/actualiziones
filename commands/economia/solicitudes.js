import {
  formatCoins,
  getDownloadRequestState,
  getEconomyConfig,
  getPrefix,
} from "./_shared.js";

export default {
  name: "solicitudes",
  command: ["solicitudes", "requests", "reqs", "misdescargas", "req", "misreq"],
  category: "economia",
  description: "Muestra tus solicitudes de descargas y el costo actual",

  run: async ({ sock, msg, from, sender, settings, esOwner }) => {
    const requests = getDownloadRequestState(sender, settings);
    const config = getEconomyConfig(settings);
    const prefix = getPrefix(settings);

    await sock.sendMessage(
      from,
      {
        text:
          `*SOLICITUDES DE DESCARGA*\n\n` +
          `Modo cobro: *${esOwner ? "EXENTO OWNER" : config.downloadBillingEnabled ? "ACTIVO" : "APAGADO"}*\n` +
          `Gratis por dia: *${requests?.dailyLimit || 0}*\n` +
          `Disponibles hoy: *${requests?.dailyRemaining || 0}*\n` +
          `Extra compradas: *${requests?.extraRemaining || 0}*\n` +
          `Usadas total: *${requests?.totalConsumed || 0}*\n` +
          `Precio por solicitud: *${formatCoins(requests?.requestPrice || config.requestPrice)}*\n\n` +
          `Compra mas con: *${prefix}buyrequests 5*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
