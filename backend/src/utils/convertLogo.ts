import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const SVG_PATH = path.join(import.meta.dirname, '../../assets/LogoConcordeBlanco.svg');
export const PNG_PATH = path.join(import.meta.dirname, '../../assets/logo.png');

export async function convertirLogo(): Promise<string> {
  if (fs.existsSync(PNG_PATH)) return PNG_PATH;
  await sharp(SVG_PATH).resize(200).png().toFile(PNG_PATH);
  return PNG_PATH;
}
