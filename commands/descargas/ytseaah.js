
import yts from 'yt-search'

export default {
  name: 'ysearch',
  command: ['yts', 'ytsearch'],
  category: 'tools',

  async run(ctx) {
    const { sock: conn, m, from, args } = ctx

    try {
      const query = Array.isArray(args) ? args.join(' ').trim() : ''

      if (!query) {
        return await conn.sendMessage(
          from,
          { text: 'Ejemplo:\n.yts bad bunny' },
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
        header: `${i + 1}`,
        title: String(v.title || 'Sin título').slice(0, 72),
        description: `⏱ ${v.timestamp || '??:??'} | 👤 ${v.author?.name || 'Desconocido'}`.slice(0, 72),
        id: `.play ${v.url}`
      }))

      return await conn.sendMessage(
        from,
        {
          text: `🎵 Resultados para: ${query}`,
          title: 'YouTube Search',
          subtitle: 'Selecciona una canción',
          footer: 'ミ★ Enigma-Bot ★彡',
          interactiveButtons: [
            {
              name: 'single_select',
              buttonParamsJson: JSON.stringify({
                title: 'Seleccionar',
                sections: [
                  {
                    title: 'Resultados encontrados',
                    rows
                  }
                ]
              })
            }
          ]
        },
        { quoted: m }
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
