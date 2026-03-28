
import yts from 'yt-search'

export default {
  name: 'ysearch',
  command: ['ytsearch', 'yts'],
  category: 'busqueda',

  async run(ctx) {
    const { sock: conn, m, text, from } = ctx

    try {
      const query = String(text || '').trim()

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

      const listSections = [
        {
          title: 'Opciones disponibles',
          rows: videos.map((video, index) => ({
            title: `${index + 1}. ${video.title}`.slice(0, 72),
            description: `⏱️ ${video.timestamp || '??:??'} | 👤 ${video.author?.name || 'Desconocido'}`.slice(0, 72),
            rowId: `.play ${video.url}`
          }))
        }
      ]

      if (typeof conn.sendList === 'function') {
        return await conn.sendList(
          from,
          '🎵 Resultados de búsqueda\nSelecciona una opción',
          'ミ★ 𝘌𝘯𝘪𝘨𝘮𝘢-𝘉𝘰𝘵 ★彡',
          'Resultados de YouTube',
          'Ver opciones',
          listSections,
          m
        )
      }

      let txt = `🎵 *RESULTADOS DE BÚSQUEDA*\n\n`
      txt += `🔎 *Texto:* ${query}\n\n`

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i]
        txt += `*${i + 1}.* ${v.title}\n`
        txt += `⏱️ ${v.timestamp || '??:??'}\n`
        txt += `👤 ${v.author?.name || 'Desconocido'}\n`
        txt += `🔗 ${v.url}\n`
        txt += `📥 Usa: .play ${v.url}\n\n`
      }

      return await conn.sendMessage(
        from,
        { text: txt },
        { quoted: m }
      )
    } catch (err) {
      console.error('Error en ysearch:', err)

      return await conn.sendMessage(
        from,
        { text: 'Ocurrió un error al buscar en YouTube.' },
        { quoted: m }
      )
    }
  }
}
