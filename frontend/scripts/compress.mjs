// Writes .br and .gz copies of the built files next to them, so the server can send them compressed without doing
// the work on every request (the backend picks the smallest one the browser accepts). Runs after `vite build`.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const compressible = /\.(js|css|html|svg|json|webmanifest|txt)$/
let before = 0, after = 0, count = 0

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (compressible.test(name) && statSync(path).size >= 1024) {
      const data = readFileSync(path)
      const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } })
      writeFileSync(path + '.br', br)
      writeFileSync(path + '.gz', gzipSync(data, { level: 9 }))
      before += data.length
      after += br.length
      count++
    }
  }
}

walk(dist)
console.log(`compressed ${count} files: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB with brotli`)
