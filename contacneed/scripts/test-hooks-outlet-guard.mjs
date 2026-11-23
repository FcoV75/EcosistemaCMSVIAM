/**
 * Guarda contra el bug que rompía al entrar a grupo/proyecto:
 * return <Outlet /> ANTES de otros hooks → React "Rendered fewer hooks".
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const files = [
  'src/routes/grupos.tsx',
  'src/routes/mi-proyecto.tsx',
  'src/routes/mensajes.tsx',
]

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

let passed = 0
for (const rel of files) {
  const src = readFileSync(resolve(root, rel), 'utf8')
  const outletEarly = /if\s*\([^\)]*pathname[^\)]*\)\s*\{\s*return\s+<Outlet\s*\/>\s*\}/
  // Old bad pattern: early return before useIdentity/useState
  const bad = outletEarly.test(src.split('useIdentity')[0] || '')
  assert(!bad, `${rel}: Outlet return aparece antes de useIdentity (rompe hooks)`)

  assert(src.includes('isChildRoute'), `${rel}: falta isChildRoute`)
  assert(
    /if\s*\(\s*isChildRoute\s*\)\s*return\s+<Outlet\s*\/>/.test(src),
    `${rel}: falta guard isChildRoute después de hooks`,
  )

  // Ensure at least one useState appears before isChildRoute return
  const childReturnIdx = src.search(/if\s*\(\s*isChildRoute\s*\)\s*return\s+<Outlet\s*\/>/)
  const firstUseState = src.indexOf('useState(')
  assert(firstUseState !== -1 && firstUseState < childReturnIdx, `${rel}: useState debe ir antes del Outlet`)
  passed += 1
  console.log('OK ', rel)
}

console.log(`\nHooks outlet guard: ${passed}/${files.length}`)
