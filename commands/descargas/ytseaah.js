
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

      const sections = [
        {
          title: 'Resultados encontrados',
          rows
        }
      ]

      let imageBuffer = null

      try {
        if (videos[0]?.thumbnail) {
          const response = await fetch(videos[0].thumbnail)
          const arrayBuffer = await response.arrayBuffer()
          imageBuffer = Buffer.from(arrayBuffer)
        }
      } catch (imgErr) {
        console.error('No pude descargar la miniatura:', imgErr)
      }

      const messageContent = {
        caption: `Resultados: ${query}\n\nSelecciona una opción`,
        footer: 'ミ★ Enigma-Bot ★彡',
        title: 'YouTube Search',
        buttonText: 'Seleccionar',
        sections
      }

      if (imageBuffer) {
        return await conn.sendMessage(
          from,
          {
            image: imageBuffer,
            ...messageContent
          },
          { quoted: m }
        )
      }

      return await conn.sendMessage(
        from,
        {
          text: `Resultados: ${query}\n\nSelecciona una opción`,
          footer: 'ミ★ Enigma-Bot ★彡',
          title: 'YouTube Search',
          buttonText: 'Seleccionar',
          sections
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
