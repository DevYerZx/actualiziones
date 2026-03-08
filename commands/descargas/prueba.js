import axios from "axios"
import yts from "yt-search"

export default {

command: ["play","yt","video"],

async run(client, message, args){

try{

if(!args || args.length === 0){
return message.reply("❌ Escribe algo para buscar\nEjemplo:\n.play bad bunny")
}

const query = args.join(" ")

await message.reply("🔎 Buscando en YouTube...")

const search = await yts(query)
const video = search.videos[0]

if(!video){
return message.reply("❌ No se encontró video")
}

const url = video.url

await message.reply("⚡ Probando APIs de descarga...")

const apis = [

{ name:"SaveTube", url:`https://cdn.savetube.me/info?url=${url}` },
{ name:"Vevioz", url:`https://api.vevioz.com/api/button/mp4/${url}` },
{ name:"Loader", url:`https://loader.to/ajax/download.php?url=${url}&format=mp4` },
{ name:"Cobalt1", url:`https://co.wuk.sh/api/json` },
{ name:"Cobalt2", url:`https://api.cobalt.tools/api/json` },
{ name:"Cobalt3", url:`https://api-cobalt.islantilla.es/api/json` },
{ name:"YT1s", url:`https://api.yt1s.com/api/ajaxSearch/index?q=${url}&vt=home` },
{ name:"YT5s", url:`https://yt5s.io/api/ajaxSearch` },
{ name:"KeepVid", url:`https://keepvid.pro/api` },
{ name:"Y2Mate", url:`https://y2mate.guru/api/convert` },
{ name:"SnapInsta", url:`https://snapinsta.app/api` },
{ name:"YTAPI", url:`https://ytapi.site/api` },
{ name:"MediaSave", url:`https://media-save.net/api` },
{ name:"VideoGrab", url:`https://videograb.net/api` },
{ name:"YTDLP", url:`https://ytdlp.online/api` },
{ name:"DLPanda", url:`https://dlpanda.com/api` },
{ name:"YTDownload", url:`https://yt-download.org/api` },
{ name:"TubeAPI", url:`https://tubeapi.com/api` },
{ name:"MP4Downloader", url:`https://mp4downloader.com/api` },
{ name:"SnapVideo", url:`https://snapvideo.net/api` }

]

let download = null
let apiUsed = null

for(const api of apis){

try{

let res

if(api.url.includes("cobalt")){
res = await axios.post(api.url,{url:url},{timeout:10000})
}else{
res = await axios.get(api.url,{timeout:10000})
}

if(res.data){

download =
res.data.url ||
res.data.download ||
res.data.result ||
res.data.link ||
res.data.video

if(download){
apiUsed = api.name
break
}

}

}catch(e){
continue
}

}

if(!download){
return message.reply("❌ Ninguna API funcionó")
}

await client.sendMessage(message.chat,{
video:{url:download},
caption:`🎬 ${video.title}

⚡ Descargado con API: ${apiUsed}`
})

}catch(err){

console.log("ERROR PLAY:",err)

message.reply("❌ Error en descarga")

}

}

}
