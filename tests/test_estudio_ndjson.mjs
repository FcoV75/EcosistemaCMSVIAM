import assert from 'node:assert/strict';
import { ndjsonEstudioResponse } from '../netlify/functions/lib/estudio-ndjson.mjs';

const res = ndjsonEstudioResponse(async (write) => {
  write({ type: 'status', msg: 'paso 1' });
  await new Promise((r) => setTimeout(r, 120));
  return { success: true, imagen_base64: 'abc', mime: 'image/jpeg', fuente: 'test' };
}, { statusInicial: 'inicio', pingMs: 30 });

assert.equal(res.status, 200);
assert.match(String(res.headers.get('content-type') || ''), /ndjson/i);

const text = await res.text();
const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
assert.ok(lines.some((o) => o.type === 'status' && o.msg === 'inicio'));
assert.ok(lines.some((o) => o.type === 'status' && o.msg === 'paso 1'));
const result = lines.find((o) => o.type === 'result');
assert.ok(result);
assert.equal(result.success, true);
assert.equal(result.fuente, 'test');
assert.equal(result.imagen_base64, 'abc');
// En runtime real los pings salen cada ~3s; aquí basta status+result del stream.
console.log('estudio-ndjson ok', { lines: lines.length, types: lines.map((o) => o.type) });
