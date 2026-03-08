import axios from "axios"
import yts from "yt-search"

const API = "https://0f66da8bd81e5d32-201-230-121-168.serveousercontent.com/ytmp3"

export default {
command: ["ytmp3yer"],
category: "descarga",

run: async (ctx) => {

const { sock, from, args } = ctx
const msg = ctx.m || ctx.msg

if (!args.length) {
return sock.sendMessage(from,{
text:"❌ Uso: .ytmp3yer canción"
},{quoted:msg})
}

try{

const query = args.join(" ")

const search = await yts(query)
const video = search.videos[0]

if(!video){
return sock.sendMessage(from,{
text:"❌ No encontré resultados"
},{quoted:msg})
}

await sock.sendMessage(from,{
image:{ url: video.thumbnail },
caption:`🎵 Descargando...\n\n${video.title}`
},{quoted:msg})

/* pedir a tu API */

const api = await axios.get(API,{
params:{ url: video.url },
timeout:20000
})

if(!api.data.status){
throw "API error"
}

const downloadUrl = api.data.download

/* descargar audio */

const audio = await axios.get(downloadUrl,{
responseType:"arraybuffer",
headers:{
"User-Agent":"Mozilla/5.0",
"Referer":"https://www.youtube.com/"
}
})

/* enviar audio */

await sock.sendMessage(from,{
audio: audio.data,
mimetype:"audio/webm",
fileName: video.title + ".mp3"
},{quoted:msg})

}catch(err){

console.log("ERROR YTMP3:",err)

sock.sendMessage(from,{
text:"❌ Error descargando el audio"
},{quoted:msg})

}

}
}
