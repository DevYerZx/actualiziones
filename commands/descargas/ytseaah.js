import yts from 'yt-search'

export default {
  name: 'ysearch',
  aliases: ['ytsearch', 'yts'],
  category: 'descargas',
  description: 'Busca videos en YouTube',
  async execute(conn, m, args) {
    try {
      const text = args.join(' ').trim()

      if (!text) {
        return await conn.sendMessage(
          m.chat,
          { text: 'Ejemplo:\n.ysearch bad bunny' },
          { quoted: m }
        )
      }

      const search = await yts(text)
      const videos = search.videos.slice(0, 10)

      if (!videos.length) {
        return await conn.sendMessage(
          m.chat,
          { text: 'No encontré resultados en YouTube.' },
          { quoted: m }
        )
      }

      const listSections = [
        {
          title: 'Resultados encontrados',
          rows: videos.map((v, i) => ({
            title: `${i + 1}. ${v.title}`.slice(0, 72),
            description: `${v.timestamp} | ${v.author?.name || 'Desconocido'}`.slice(0, 72),
            rowId: `.play ${v.url}`
          }))
        }
      ]

      if (typeof conn.sendList === 'function') {
        return await conn.sendList(
          m.chat,
          `🎵 Resultados para: ${text}\nSelecciona una opción`,
          'ミ★ 𝘌𝘯𝘪𝘨𝘮𝘢-𝘉𝘰𝘵 ★彡',
          'Resultados de YouTube',
          'Ver opciones',
          listSections,
          m
        )
      }

      let txt = `🎵 *RESULTADOS DE BÚSQUEDA*\n\n`
      txt += `🔎 *Texto:* ${text}\n\n`

      for (let i = 0; i < videos.length; i++) {
        const v = videos[i]
        txt += `*${i + 1}.* ${v.title}\n`
        txt += `⏱️ ${v.timestamp}\n`
        txt += `👤 ${v.author?.name || 'Desconocido'}\n`
        txt += `🔗 ${v.url}\n`
        txt += `📥 Usa: .play ${v.url}\n\n`
      }

      return await conn.sendMessage(
        m.chat,
        { text: txt },
        { quoted: m }
      )
    } catch (err) {
      console.error('Error en ysearch:', err)
      return await conn.sendMessage(
        m.chat,
        { text: 'Ocurrió un error al buscar en YouTube.' },
        { quoted: m }
      )
    }
  }
}
