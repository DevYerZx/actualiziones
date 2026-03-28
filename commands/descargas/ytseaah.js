import yts from 'yt-search'

case 'ysearch':
case 'ytsearch': {
  if (!text) {
    return m.reply('Ejemplo:\n.ysearch ozuna')
  }

  try {
    let search = await yts(text)
    let videos = search.videos.slice(0, 10)

    if (!videos || !videos.length) {
      return m.reply('No encontré resultados.')
    }

    let listSections = [
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
      await conn.sendList(
        m.chat,
        `🎵 Resultados para: ${text}\nSelecciona una opción`,
        'ミ★ 𝘌𝘯𝘪𝘨𝘮𝘢-𝘉𝘰𝘵 ★彡',
        'YouTube Search',
        'Ver resultados',
        listSections,
        m
      )
    } else {
      let caption = `🎵 *RESULTADOS PARA:* ${text}\n\n`

      for (let i = 0; i < videos.length; i++) {
        let v = videos[i]
        caption += `*${i + 1}.* ${v.title}\n`
        caption += `⏱️ ${v.timestamp}\n`
        caption += `👤 ${v.author?.name || 'Desconocido'}\n`
        caption += `🔗 ${v.url}\n`
        caption += `📥 .play ${v.url}\n\n`
      }

      await conn.sendMessage(
        m.chat,
        { text: caption },
        { quoted: m }
      )
    }
  } catch (e) {
    console.error(e)
    m.reply('Error al hacer la búsqueda en YouTube.')
  }
}
break
