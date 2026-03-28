
import yts from 'yt-search'

export default {
  name: 'ysearch',
  command: ['yts', 'ytsearch'],
  category: 'tools',

  async run(ctx) {
    const { sock: conn, m, from, args, isGroup } = ctx

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

      // En privado: lista seleccionable
      if (!isGroup) {
        return await conn.sendMessage(
          from,
          {
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
          },
          { quoted: m }
        )
      }

      // En grupo: botones simples + texto
      const top = videos.slice(0, 3)

      return await conn.sendMessage(
        from,
        {
          text:
            `🎵 *Resultados:* ${query}\n\n` +
            top.map((v, i) => `*${i + 1}.* ${v.title}\n${v.url}`).join('\n\n'),
          footer: 'En grupos uso botones simples porque la lista no abre bien aquí.',
          buttons: top.map((v, i) => ({
            buttonId: `.play ${v.url}`,
            buttonText: { displayText: `Opción ${i + 1}` },
            type: 1
          }))
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
