import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const API_BASE = "https://dvyer-api.onrender.com"
const channelInfo = global.channelInfo || {}

const AUDIO_QUALITY = "128k"
const TMP_AUDIO = "./tmp_audio.m4a"
const TMP_THUMB = "./tmp_thumb.jpg"
const TMP_FINAL = "./tmp_final.mp3"

function safeFileName(name){
  return String(name || "audio")
    .replace(/[\\/:*?"<>|]/g,"")
    .slice(0,80)
}

export default {
  command:["play2"],
  category:"descarga",

  run: async (ctx)=>{
    const {sock,from,args} = ctx
    const msg = ctx.m || ctx.msg

    if(!args.length){
      return sock.sendMessage(from,{
        text:"❌ Uso: .play2 canción\nEjemplo:\n.play2 ozuna",
        ...channelInfo
      })
    }

    try{

      // 🔎 buscar video
      const query = args.join(" ")
      const search = await yts(query)
      const video = search.videos?.[0]

      if(!video){
        return sock.sendMessage(from,{
          text:"❌ No encontré resultados",
          ...channelInfo
        })
      }

      await sock.sendMessage(from,{
        image:{url:video.thumbnail},
        caption:`🎵 *${video.title}*\n⏱️ ${video.timestamp}\n\n⬇️ Procesando audio...`,
        ...channelInfo
      },{quoted:msg})

      // pedir audio a API
      const {data} = await axios.get(`${API_BASE}/ytdl`,{
        params:{
          type:"audio",
          url:video.url,
          quality:AUDIO_QUALITY
        }
      })

      const audioUrl =
        data.result.url ||
        data.result.download_url_full ||
        data.result.direct_url

      if(!audioUrl) throw new Error("No audio url")

      // descargar audio
      const audioBuffer = (await axios.get(audioUrl,{
        responseType:"arraybuffer"
      })).data

      fs.writeFileSync(TMP_AUDIO,audioBuffer)

      // descargar portada
      const thumbBuffer = (await axios.get(video.thumbnail,{
        responseType:"arraybuffer"
      })).data

      fs.writeFileSync(TMP_THUMB,thumbBuffer)

      // 🎧 convertir con FFmpeg + metadata
      await execAsync(`
      ffmpeg -y -i ${TMP_AUDIO} -i ${TMP_THUMB} \
      -map 0:a -map 1:v \
      -c:a libmp3lame -b:a 192k \
      -metadata title="${video.title}" \
      -metadata artist="YouTube" \
      -id3v2_version 3 \
      ${TMP_FINAL}
      `)

      const finalBuffer = fs.readFileSync(TMP_FINAL)

      // enviar audio
      await sock.sendMessage(from,{
        audio:finalBuffer,
        mimetype:"audio/mpeg",
        fileName:safeFileName(video.title)+".mp3",
        ...channelInfo
      },{quoted:msg})

      // limpiar archivos
      fs.unlinkSync(TMP_AUDIO)
      fs.unlinkSync(TMP_THUMB)
      fs.unlinkSync(TMP_FINAL)

    }catch(err){

      console.log("[PLAY2 ERROR]",err)

      await sock.sendMessage(from,{
        text:"❌ Error descargando música",
        ...channelInfo
      },{quoted:msg})

    }
  }
}