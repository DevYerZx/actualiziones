import yts from 'yt-search'

export default {
  name: 'ysearch',
  command: ['yts', 'ytsearch'],
  category: 'tools',

  async run(ctx) {
    const { sock: conn, m, from, args } = ctx

    try {
      const query = args.join(' ')
      if (!query) {
        return m.reply('Ejemplo:\n.yts ozuna odisea')
      }

      const res = await yts(query)
      const videos = res.videos.slice(0, 10)

      if (!videos.length) return m.reply('No encontré resultados')

      // 👉 filas
      const rows = videos.map((v, i) => ({
        title: `${i + 1}. ${v.title}`,
        description: `⏱ ${v.timestamp} | 👤 ${v.author.name}`,
        rowId: `.play ${v.url}`
      }))

      // 👉 secciones
      const sections = [
        {
          title: "Resultados encontrados",
          rows
        }
      ]

      // 👉 imagen (opcional, puedes cambiarla)
      const thumb = await (await fetch(videos[0].thumbnail)).buffer()

      await conn.sendMessage(
        from,
        {
          image: thumb,
          caption: `Resultados: ${query}\n\nSelecciona una opción`,
          footer: "ミ★ Enigma-Bot ★彡",
          title: "YouTube Search",
          buttonText: "Seleccionar",
          sections
        },
        { quoted: m }
      )

    } catch (e) {
      console.error(e)
      m.reply('Error en ysearch')
    }
  }
}
