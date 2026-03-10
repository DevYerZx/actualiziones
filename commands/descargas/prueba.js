import axios from "axios"
import yts from "yt-search"

const API = "https://dvyer-api.onrender.com/ytmp3?url="
const channelInfo = global.channelInfo || {}

function safeFileName(name){
  return String(name || "audio")
    .replace(/[\\/:*?"<>|]/g,"")
    .slice(0,80)
}

export default {
  command:["mp5"],
  category:"descarga",

  run: async (ctx)=>{
    const {sock, from, args} = ctx
    const msg = ctx.m || ctx.msg

    if(!args.length){
      return sock.sendMessage(from,{
        text:"❌ Uso: .play canción\nEjemplo:\n.play ozuna",
        ...channelInfo
      })
    }

    try {

      const query = args.join(" ")
      const search = await yts(query)
      const video = search.videos[0]

      if(!video){
        return sock.sendMessage(from,{
          text:"❌ No encontré resultados",
          ...channelInfo
        })
      }

      await sock.sendMessage(from,{
        image:{url:video.thumbnail},
        caption:`🎵 *${video.title}*\n⏱️ ${video.timestamp}\n\n⬇️ Descargando audio...`,
        ...channelInfo
      }, {quoted: msg})

      // NUEVA API
      const {data} = await axios.get(`${API}${encodeURIComponent(video.url)}`)

      if(!data?.status || !data?.result?.direct_url){
        throw new Error("API no devolvió audio")
      }

      const audioUrl = data.result.direct_url
      const fileName = safeFileName(video.title)+".m4a"

      await sock.sendMessage(from,{
        audio:{ url: audioUrl },
        mimetype:"audio/mp4",
        fileName,
        ...channelInfo
      }, {quoted: msg})

    } catch(err){
      console.log("[PLAY ERROR]", err)

      await sock.sendMessage(from,{
        text:"❌ Error descargando música",
        ...channelInfo
      })
    }
  }
}