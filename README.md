# FSociety Bot

Bot de WhatsApp multi-instancia hecho con Baileys, pensado para correr como bot principal y tambien como sistema de subbots. Incluye comandos de administracion, descargas, juegos, economia, utilidades de grupo, herramientas de sistema y paneles de control para VPS y hosting.

## Tabla De Contenido

- [Resumen](#resumen)
- [Funciones Principales](#funciones-principales)
- [Requisitos](#requisitos)
- [Instalacion Rapida](#instalacion-rapida)
- [Instalacion En Termux](#instalacion-en-termux)
- [Instalacion En PC O VPS Linux](#instalacion-en-pc-o-vps-linux)
- [Instalacion En Windows](#instalacion-en-windows)
- [Ejecucion Con PM2](#ejecucion-con-pm2)
- [Uso En Hosting](#uso-en-hosting)
- [Configuracion Inicial](#configuracion-inicial)
- [Primer Vinculado](#primer-vinculado)
- [Subbots](#subbots)
- [Scripts Disponibles](#scripts-disponibles)
- [Estructura Del Proyecto](#estructura-del-proyecto)
- [Recomendaciones](#recomendaciones)

## Resumen

FSociety Bot esta preparado para:

- correr como bot principal
- generar pairing code del bot principal por consola
- manejar subbots por slots
- trabajar en VPS con PM2 o en hosting administrado
- guardar sesiones por carpeta para no perder la vinculacion
- usar categorias de comandos separadas por modulo

## Funciones Principales

| Area | Incluye |
| --- | --- |
| Administracion | `eval`, `exec`, `join`, `leave`, `getfile`, `vip`, `setvar` |
| Grupos | `antilink`, `antispam`, `antiflood`, `antifake`, `welcome`, `modoadmi` |
| Descargas | YouTube MP3/MP4, TikTok, Spotify, Instagram, Facebook, MediaFire, Mega |
| Juegos | trivia, ahorcado, piedra papel tijera, tictactoe, adivina, emoji quiz |
| Economia | coins, banco, daily, transferencias, shop, solicitudes |
| Sistema | status, botinfo, backup, restore, update, dashboard, autosetup |
| Subbots | slots, pairing publico, panel de estado, liberacion y reset |

## Requisitos

Antes de iniciar, ten instalado lo siguiente:

- Node.js 18 o superior
- npm
- git
- ffmpeg
- PM2 opcional, recomendado para VPS

Tambien es importante conservar estas rutas si usas hosting o reinicios automaticos:

- `settings/`
- `database/`
- `dvyer-session/`
- `dvyer-session-subbot*/`

## Instalacion Rapida

```bash
git clone https://github.com/DevYerZx/fsociety-bot.git
cd fsociety-bot
npm install
npm start
```

## Instalacion En Termux

### 1. Actualiza paquetes

```bash
pkg update -y
pkg upgrade -y
```

### 2. Instala dependencias

```bash
pkg install -y git nodejs ffmpeg
termux-setup-storage
```

### 3. Clona el repositorio

```bash
git clone https://github.com/DevYerZx/fsociety-bot.git
cd fsociety-bot
```

### 4. Instala paquetes de Node

```bash
npm install
```

### 5. Inicia el bot

```bash
npm start
```

Si Termux te da problemas de memoria durante `npm install`, prueba:

```bash
npm cache clean --force
```

## Instalacion En PC O VPS Linux

### Ubuntu o Debian

```bash
sudo apt update
sudo apt install -y git ffmpeg curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Clonar e instalar

```bash
git clone https://github.com/DevYerZx/fsociety-bot.git
cd fsociety-bot
npm install
```

### Ejecutar

```bash
npm start
```

## Instalacion En Windows

### 1. Instala

- Node.js LTS
- Git
- FFmpeg con la variable `PATH` configurada

### 2. Clona el proyecto

Abre PowerShell dentro de la carpeta donde quieras guardar el bot y ejecuta:

```powershell
git clone https://github.com/DevYerZx/fsociety-bot.git
cd fsociety-bot
npm install
npm start
```

## Ejecucion Con PM2

Ideal para VPS o servidores donde quieras que el bot se reinicie solo.

### Instalar PM2

```bash
npm install -g pm2
```

### Iniciar con el ecosystem del proyecto

```bash
npm run pm2:auto:start
```

### Reiniciar

```bash
npm run pm2:auto:restart
```

### Ver logs

```bash
pm2 logs
```

### Guardar proceso para arranque automatico

```bash
pm2 save
pm2 startup
```

El archivo `ecosystem.config.cjs` ya esta preparado para levantar `main` y los subbots activos cuando corresponda.

## Uso En Hosting

Este proyecto detecta varios entornos administrados como:

- Railway
- Render
- Pterodactyl
- Koyeb
- Heroku

### Configuracion recomendada

| Campo | Valor sugerido |
| --- | --- |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Node Version | 18 o superior |
| Disco persistente | obligatorio |

### Importante en hosting

- Debes mantener almacenamiento persistente para no perder sesiones.
- Si tu hosting borra archivos al reiniciar, tendras que volver a vincular el bot.
- `ffmpeg` debe estar disponible en el sistema si usaras comandos multimedia.
- Para VPS con varios procesos, PM2 es la opcion mas estable.

## Configuracion Inicial

La configuracion principal esta en:

- `settings/settings.json`

Campos que normalmente vas a editar:

| Campo | Uso |
| --- | --- |
| `botName` | nombre visible del bot |
| `ownerName` | nombre del owner |
| `ownerNumbers` | numeros autorizados |
| `ownerLids` | LIDs del owner si usas ese formato |
| `prefix` | prefijos permitidos |
| `botNumber` | numero principal del bot |
| `pairingNumber` | numero para pairing automatico del bot principal |
| `subbot.publicRequests` | activa o desactiva pedidos publicos |
| `subbot.maxSlots` | cantidad de slots disponibles |
| `newsletter` | datos del canal o newsletter |

Ejemplo rapido:

```json
{
  "botName": "Fsociety bot",
  "ownerName": "Tu nombre",
  "prefix": [".", "/", "!", "#"],
  "ownerNumbers": ["51999999999"],
  "botNumber": "51999999999",
  "pairingNumber": ""
}
```

## Primer Vinculado

En el primer arranque, el bot principal puede pedirte el numero por consola para generar el pairing code.

### Flujo recomendado

1. Ejecuta `npm start`
2. Escribe el numero del bot con codigo de pais y sin `+`
3. Espera el codigo de vinculacion
4. En WhatsApp entra a `Dispositivos vinculados`
5. Usa la opcion `Vincular con numero de telefono`
6. Ingresa el codigo mostrado en consola

Cuando el bot quede vinculado, la sesion se guardara en `dvyer-session/`.

## Subbots

El proyecto soporta multiples subbots por slots.

### Lo importante

- el bot principal debe estar vinculado primero
- los subbots usan carpetas `dvyer-session-subbot*`
- la capacidad se controla desde `settings/settings.json`
- tambien puedes administrar slots desde comandos del bot

Comandos relacionados:

- `.subbot`
- `.subbots`
- `.subboton`
- `.subbotoff`

## Scripts Disponibles

| Script | Uso |
| --- | --- |
| `npm start` | inicia el bot |
| `npm run check` | revisa sintaxis del archivo principal |
| `npm run pm2:auto:start` | inicia con PM2 |
| `npm run pm2:auto:restart` | reinicia con PM2 |
| `bash start.sh` | inicio directo por script |

## Estructura Del Proyecto

```text
.
|-- index.js
|-- package.json
|-- ecosystem.config.cjs
|-- start.sh
|-- commands/
|   |-- admin/
|   |-- descargas/
|   |-- economia/
|   |-- grupos/
|   |-- ia/
|   |-- juegos/
|   |-- media/
|   |-- menu/
|   |-- sistema/
|   `-- subbots/
|-- lib/
|-- settings/
|-- database/
`-- assets/
```

## Recomendaciones

- no subas sesiones de WhatsApp al repositorio
- no compartas tokens ni claves dentro del codigo
- usa PM2 si tu bot va a estar 24/7
- usa disco persistente si despliegas en hosting
- manten `ffmpeg` instalado para comandos multimedia
- haz backups periodicos de `settings/`, `database/` y sesiones

---

Si quieres, el siguiente paso puede ser que tambien te deje un README con seccion de comandos principales, capturas y formato mas tipo landing para GitHub.
