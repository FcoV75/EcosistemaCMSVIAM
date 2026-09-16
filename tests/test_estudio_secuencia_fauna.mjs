import assert from 'node:assert/strict';
import {
  esEscenaPanteraMono,
  cutoutStudioGray,
} from '../netlify/functions/lib/estudio-secuencia-fauna.mjs';
import sharp from 'sharp';

assert.ok(esEscenaPanteraMono(
  'una pantera arriba de un árbol acercándose lentamente a un mono capuchino',
));
assert.ok(!esEscenaPanteraMono('un cangrejo nadando entre anguilas'));

// Cutout: gray studio → transparent
const gray = await sharp({
  create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 200, b: 200 } },
})
  .composite([{
    input: await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 10, b: 10 } },
    }).png().toBuffer(),
    left: 22,
    top: 22,
  }])
  .jpeg()
  .toBuffer();

const cut = await cutoutStudioGray(gray);
const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(info.channels, 4);
// Corner should be transparent
assert.equal(data[3], 0);
// Center dark blob should stay opaque
const mid = ((32 * 64 + 32) * 4) + 3;
assert.ok(data[mid] > 200);

console.log('estudio-secuencia-fauna ok');
