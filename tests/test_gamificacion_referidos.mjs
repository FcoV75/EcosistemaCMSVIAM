import assert from 'node:assert/strict'
import {
  MAX_MESES_PRO_CANJE_ANUAL,
  PUNTOS_MENSUALIDAD_GRATIS,
  PUNTOS_POR_REFERIDO_REGISTRO,
  generarCodigoReferido,
} from '../ContacNeed - Arquitectura Modular Diamante Estabilizada/src/lib/gamificacion.ts'

assert.equal(PUNTOS_POR_REFERIDO_REGISTRO, 10)
assert.equal(PUNTOS_MENSUALIDAD_GRATIS, 100)
assert.equal(MAX_MESES_PRO_CANJE_ANUAL, 4)

// 10 referidos = 100 pts = 1 mes PRO
assert.equal(10 * PUNTOS_POR_REFERIDO_REGISTRO, PUNTOS_MENSUALIDAD_GRATIS)

const codigo = generarCodigoReferido('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
assert.match(codigo, /^CN-[A-F0-9]{8}$/)

// Tope anual: 4 meses ⇒ 400 pts canjeables/año
assert.equal(MAX_MESES_PRO_CANJE_ANUAL * PUNTOS_MENSUALIDAD_GRATIS, 400)

console.log('gamificacion-referidos ok — 10 pts/registro, 100=1 mes PRO, máx 4/año')
