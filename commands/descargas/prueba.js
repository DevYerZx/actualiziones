import axios from "axios"
import yts from "yt-search"

export default {

command:["yt2"],

async run({ sock, from, args }){

try{

if(!args.length){
return sock.sendMessage(from,{
text:"❌ Ejemplo:\n.yt2 bad bunny"
})
}

const query = args.join(" ")

await sock.sendMessage(from,{text:"🔎 Buscando..."})

const search = await yts(query)
const video = search.videos[0]

if(!video){
return sock.sendMessage(from,{text:"❌ No encontrado"})
}

const yt = video.url

await sock.sendMessage(from,{text:"⏳ Enviando a Loader..."})

const convert = await axios.get(
`https://loader.to/ajax/download.php?format=mp4&url=${encodeURIComponent(yt)}`
)

const id = convert.data.id

if(!id){
return sock.sendMessage(from,{text:"❌ Error iniciando descarga"})
}

let link = null

for(let i=0;i<15;i++){

await new Promise(r=>setTimeout(r,2000))

const progress = await axios.get(
`https://loader.to/ajax/progress.php?id=${id}`
)

if(progress.data.download_url){

link = progress.data.download_url
break

}

}

if(!link){
return sock.sendMessage(from,{text:"❌ No se pudo obtener el video"})
}

await sock.sendMessage(from,{
video:{url:link},
caption:`🎬 ${video.title}`
})

}catch(e){

console.error("YT2 ERROR:",e)

sock.sendMessage(from,{
text:"❌ Error descargando"
})

}

}

}
