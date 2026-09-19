const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

const SVG_PATH = path.join(__dirname, '../../assets/LogoConcordeBlanco.svg')
const PNG_PATH = path.join(__dirname, '../../assets/logo.png')

async function convertirLogo() {
  if (fs.existsSync(PNG_PATH)) return PNG_PATH
  await sharp(SVG_PATH).resize(200).png().toFile(PNG_PATH)
  return PNG_PATH
}

module.exports = { convertirLogo, PNG_PATH }