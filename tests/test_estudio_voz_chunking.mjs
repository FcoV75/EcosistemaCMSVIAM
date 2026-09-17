import assert from 'node:assert/strict';
import {
  CHUNK_CHARS_VOZ,
  MAX_CHARS_SOLO_TTS,
  debeSaltarCuotaVoz,
  envolverTextoTtsGemini,
  envolverTextoTtsGeminiAlt,
  palabrasParaSegundos,
  partirTextoVoz,
  speechFicticio,
  stitchAudioBuffers,
} from '../netlify/functions/lib/estudio-voz-helpers.mjs';
import { partirTexto, PALABRAS_POR_SEGUNDO } from '../netlify/functions/lib/estudio-limites.mjs';

assert.equal(PALABRAS_POR_SEGUNDO, 2.4);
assert.equal(palabrasParaSegundos(30), 72);
assert.equal(palabrasParaSegundos(60), 144);
assert.equal(palabrasParaSegundos(120), 288);
assert.equal(palabrasParaSegundos(300), 720);

for (const seg of [30, 60, 120, 300]) {
  const palabras = palabrasParaSegundos(seg);
  const speech = speechFicticio(palabras);
  const contadas = speech.split(/\s+/).filter(Boolean).length;
  assert.equal(contadas, palabras, `speech ${seg}s debe tener ${palabras} palabras`);
  const chunks = partirTextoVoz(speech, CHUNK_CHARS_VOZ);
  assert.ok(chunks.length >= 1, `debe partir speech ${seg}s`);
  if (seg >= 60) {
    assert.ok(chunks.length >= 2, `speech ${seg}s (~${palabras} palabras) necesita varios chunks`);
  }
  if (seg >= 120) {
    assert.ok(chunks.length >= 3, `speech ${seg}s necesita al menos 3 chunks`);
  }
  if (seg >= 300) {
    assert.ok(chunks.length >= 8, `speech 300s necesita muchos chunks (got ${chunks.length})`);
  }
  for (const c of chunks) {
    assert.ok(c.length <= CHUNK_CHARS_VOZ + 5, `chunk no debe superar ~${CHUNK_CHARS_VOZ}`);
  }
  const rejoined = chunks.join(' ');
  assert.ok(rejoined.length >= speech.length * 0.9, 'rejoin conserva casi todo el texto');
}

const corto = speechFicticio(20);
assert.equal(partirTextoVoz(corto, CHUNK_CHARS_VOZ).length, 1);

const wrap = envolverTextoTtsGemini('Hola mundo');
assert.match(wrap, /Lee en voz alta/i);
assert.match(wrap, /Hola mundo/);
assert.equal(envolverTextoTtsGemini(wrap), wrap);

const wrapAlt = envolverTextoTtsGeminiAlt('Buenas tardes');
assert.match(wrapAlt, /Say clearly in Spanish/i);

assert.equal(debeSaltarCuotaVoz({ soloTts: true, chunkIndex: 1 }), true);
assert.equal(debeSaltarCuotaVoz({ soloTts: true, chunkIndex: 0 }), false);
assert.equal(debeSaltarCuotaVoz({ soloTts: false, chunkIndex: 2 }), false);

const a = Buffer.from([1, 2, 3]);
const b = Buffer.from([4, 5]);
const stitched = stitchAudioBuffers([a, b]);
assert.deepEqual([...stitched], [1, 2, 3, 4, 5]);
assert.equal(stitchAudioBuffers([]), null);
assert.equal(stitchAudioBuffers([a]), a);

assert.ok(MAX_CHARS_SOLO_TTS >= 800);
assert.ok(partirTexto('Uno. Dos. Tres.', 8).length >= 2);

console.log('estudio-voz-chunking ok', {
  chunks30: partirTextoVoz(speechFicticio(72)).length,
  chunks60: partirTextoVoz(speechFicticio(144)).length,
  chunks120: partirTextoVoz(speechFicticio(288)).length,
  chunks300: partirTextoVoz(speechFicticio(720)).length,
});
