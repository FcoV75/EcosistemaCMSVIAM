import assert from 'node:assert/strict'
import fs from 'node:fs'

const catalog = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/lib/cursos-educativos.ts',
  'utf8',
)
for (const slug of [
  'la-mente-que-crea-fortuna',
  'la-multiplicacion-silenciosa',
  'el-codigo-de-la-realidad',
]) {
  assert.match(catalog, new RegExp(`slug: '${slug}'`))
}

const bundled = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/cursos-bundled.ts',
  'utf8',
)
assert.match(bundled, /la-mente-que-crea-fortuna/)
assert.match(bundled, /la-multiplicacion-silenciosa/)
assert.match(bundled, /el-codigo-de-la-realidad/)

for (const [slug, zip] of [
  ['la-mente-que-crea-fortuna', 'paquete-recuperacion-fortuna-k4n8p2w6.zip'],
  ['la-multiplicacion-silenciosa', 'paquete-recuperacion-multiplica-t7v3m9q2.zip'],
  ['el-codigo-de-la-realidad', 'paquete-recuperacion-codigo-r5w8n3k7.zip'],
]) {
  const base = `ContacNeed - Arquitectura Modular Diamante Estabilizada`
  assert.ok(fs.existsSync(`${base}/content/cursos/${slug}/index.html`))
  assert.ok(fs.existsSync(`${base}/content/cursos/${slug}/slides.js`))
  assert.ok(fs.existsSync(`${base}/content/cursos/${slug}/diapositivas.html`))
  assert.ok(fs.existsSync(`${base}/content/cursos/${slug}/guia-docente.md`))
  assert.ok(fs.existsSync(`${base}/public/cursos-assets/${slug}/${zip}`))
  const slides = fs.readFileSync(`${base}/content/cursos/${slug}/slides.js`, 'utf8')
  assert.match(slides, /window\.CURSO_SLIDES/)
  assert.match(slides, /Etapa 8/)
}

const support = fs.readFileSync(
  'ContacNeed - Arquitectura Modular Diamante Estabilizada/src/server/support.functions.ts',
  'utf8',
)
assert.match(support, /La mente que crea fortuna/)
assert.match(support, /La multiplicación silenciosa/)
assert.match(support, /El código de la realidad/)

console.log('test_escuela_3_cursos_nuevos: ok')
