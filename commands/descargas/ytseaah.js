
import yts from 'yt-search'

export default {
  name: 'ysearch',
  command: ['ytsearch', 'yts'],
  category: 'tools',

  async run(ctx) {
    const { sock: conn, m, from, args } = ctx

    try {
      const query = Array.isArray(args) ? args.join(' ').trim() : ''

      if (!query) {
        return await conn.sendMessage(
          from,
          { text: 'Ejemplo:\n.ysearch bad bunny' },
          { quoted: m }
        )
      }

      const search = await yts(query)
      const videos = Array.isArray(search?.videos) ? search.videos.slice(0, 10) : []

      if (!videos.length) {
        return await conn.sendMessage(
          from,
          { text: 'No encontré resultados en YouTube.' },
          { quoted: m }
        )
      }

      const rows = videos.map((video, index) => ({
        title: `${index + 1}. ${video.title}`.slice(0, 72),
        description: `👤 ${video.author?.name || 'Desconocido'} | ⏱️ ${video.timestamp || '??:??'}`.slice(0, 72),
        rowId: `.play ${video.url}`
      }))

      return await conn.sendMessage(
        from,
        {
          text: '🎵 Resultados de búsqueda\nSelecciona una opción',
          footer: 'ミ★ 𝘌𝘯𝘪𝘨𝘮𝘢-𝘉𝘰𝘵 ★彡',
          title: 'Resultados de YouTube',
          sections: [
            {
              title: 'Opciones disponibles',
              rows
            }
          ],
          buttonText: 'Ver opciones'
        },
        { quoted: m }
      )
    } catch (err) {
      console.error('Error en ysearch:', err)

      try {
        return await conn.sendMessage(
          from,
          { text: `Error en ysearch:\n${err?.message || err}` },
          { quoted: m }
        )
      } catch {}
    }
  }
}
