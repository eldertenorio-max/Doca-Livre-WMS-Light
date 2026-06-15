import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'src/assets/logo-dis-logistica-inteligente.png')
const publicDir = path.join(root, 'public')
const pwaDir = path.join(publicDir, 'pwa')

const bg = { r: 0, g: 0, b: 0, alpha: 1 }

async function writeIcon(size, outPath) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: bg })
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log('ok', path.relative(root, outPath))
}

await mkdir(pwaDir, { recursive: true })

await Promise.all([
  writeIcon(16, path.join(publicDir, 'favicon-16.png')),
  writeIcon(32, path.join(publicDir, 'favicon-32.png')),
  writeIcon(180, path.join(publicDir, 'apple-touch-icon.png')),
  writeIcon(192, path.join(pwaDir, 'icon-192.png')),
  writeIcon(512, path.join(pwaDir, 'icon-512.png')),
])
