import yts from 'yt-search'

const handler = async (m, { conn, text }) => {
  try {
    if (!text) {
      return m.reply('Ejemplo:\n.ysearch bad bunny')
    }

    let search = await yts(text)
    let videos = search.videos.slice(0, 10)

    if (!videos || !videos.length) {
      return m.reply('No encontré resultados en YouTube.')
    }

    let listSections = [
      {
        title: 'Opciones disponibles',
        rows: videos.map((video, index) => ({
          title: `${index + 1}. ${video.title}`.slice(0, 72),
          description: `⏱️ ${video.timestamp} | 👤 ${video.author?.name || 'Desconocido'}`.slice(0, 72),
          rowId: `.play ${video.url}`
        }))
      }
    ]

    await conn.sendList(
      m.chat,
      `🎵 Resultados de búsqueda\nSelecciona una opción`,
      'ミ★ 𝘌𝘯𝘪𝘨𝘮𝘢-𝘉𝘰𝘵 ★彡',
      'Resultados de YouTube',
      'Ver opciones',
      listSections,
      m
    )
  } catch (e) {
    console.error('Error en ysearch:', e)
    m.reply('Ocurrió un error al buscar en YouTube.')
  }
}

handler.help = ['ysearch <texto>']
handler.tags = ['descargas']
handler.command = ['ysearch', 'ytsearch', 'yts']

export default handler
