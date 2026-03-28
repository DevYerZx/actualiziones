
import yts from 'yt-search'

export default {
  name: 'ysearch',
  command: ['yts', 'ytsearch'],
  category: 'tools',

  async run(ctx) {
    const { sock: conn, m, from, sender, args, isGroup } = ctx

    try {
      const query = Array.isArray(args) ? args.join(' ').trim() : ''

      if (!query) {
        return await conn.sendMessage(
          from,
          { text: 'Ejemplo:\n.yts ozuna odisea' },
          { quoted: m }
        )
      }

      const res = await yts(query)
      const videos = Array.isArray(res?.videos) ? res.videos.slice(0, 10) : []

      if (!videos.length) {
        return await conn.sendMessage(
          from,
          { text: 'No encontré resultados.' },
          { quoted: m }
        )
      }

      const rows = videos.map((v, i) => ({
        title: `${i + 1}. ${v.title}`.slice(0, 72),
        description: `⏱ ${v.timestamp || '??:??'} | 👤 ${v.author?.name || 'Desconocido'}`.slice(0, 72),
        rowId: `.play ${v.url}`
      }))

      const privateJid = String(sender || '').includes('@')
        ? sender
        : `${String(sender || '').replace(/[^0-9]/g, '')}@s.whatsapp.net`

      const listPayload = {
        text: `🎵 Resultados: ${query}\n\nSelecciona una opción`,
        footer: 'ミ★ Enigma-Bot ★彡',
        title: 'YouTube Search',
        buttonText: 'Seleccionar',
        sections: [
          {
            title: 'Resultados encontrados',
            rows
          }
        ]
      }

      if (!isGroup) {
        return await conn.sendMessage(
          from,
          listPayload,
          { quoted: m }
        )
      }

      await conn.sendMessage(
        from,
        {
          text: '📩 Te envié la lista al privado para que puedas seleccionar una opción.'
        },
        { quoted: m }
      )

      return await conn.sendMessage(
        privateJid,
        listPayload,
        {}
      )
    } catch (e) {
      console.error('Error en ysearch:', e)

      return await conn.sendMessage(
        from,
        { text: `Error en ysearch:\n${e?.message || e}` },
        { quoted: m }
      )
    }
  }
}
