/**
 * Secuencia compuesta pantera→capuchino (fallback sin I2V).
 * Flux suele fusionar especies; aquí se generan assets por separado y se colocan
 * en beats de aproximación + huida sobre una rama.
 */
import sharp from 'sharp';
import { scrubPollinationsWatermark } from './estudio-imagen-gen.mjs';
import { seedDesdePrompt, sinAcentos } from './estudio-prompt-visual.mjs';

async function fetchPollinations(prompt, seed, { width = 1280, height = 720, model = 'flux', negative = '' } = {}) {
  const neg = encodeURIComponent(
    `blurry, watermark, logo, text, people, deformed, low quality, ${negative}`,
  );
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&private=true&nofeed=true&enhance=false&model=${model}&seed=${seed}&negative=${neg}&referrer=video_diamante`;
  const r = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) return null;
  let buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 10000) return null;
  buf = await scrubPollinationsWatermark(buf);
  return buf;
}

async function genConReintentos(prompt, baseSeed, negative, models = ['flux', 'flux-realism']) {
  for (let i = 0; i < models.length; i += 1) {
    const buf = await fetchPollinations(prompt, baseSeed + i * 17, {
      model: models[i],
      negative,
    });
    if (buf) return buf;
  }
  return null;
}

/** Recorte por flood-fill desde bordes (fondo estudio gris). */
export async function cutoutStudioGray(jpegBuf) {
  const { data, info } = await sharp(jpegBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;
  const isBg = (idx) => {
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    return lum > 95 && sat < 60;
  };
  const mark = new Uint8Array(n);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (mark[idx]) return;
    if (!isBg(idx)) return;
    mark[idx] = 1;
    q.push(idx);
  };
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (q.length) {
    const idx = q.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let idx = 0; idx < n; idx += 1) {
    if (mark[idx]) data[idx * 4 + 3] = 0;
    else {
      const i = idx * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 155 && sat < 38) data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

export function esEscenaPanteraMono(texto = '') {
  const n = sinAcentos(texto);
  return /\b(pantera|panther|jaguar)\b/.test(n) && /\b(mono|monkey|capuchin)\b/.test(n);
}

/**
 * 4 placas: pantera se acerca por la rama; mono huye saltando.
 * @returns {Promise<null|{secuencia: Array<{imagen_base64,mime}>, fuente:string}>}
 */
export async function generarSecuenciaPanteraMono(original = '', { timeoutMs = 70000 } = {}) {
  const t0 = Date.now();
  const left = () => timeoutMs - (Date.now() - t0);
  if (left() < 20000) return null;

  const base = seedDesdePrompt(`fauna-comp:${original}`);

  const rama = await genConReintentos(
    'Close-up photoreal thick mossy horizontal tree branch across mid frame, rainforest canopy soft bokeh, daylight, EMPTY no animals, sharp bark 16:9',
    base + 1,
    'animals, wildlife, birds, monkey, panther, bear, people',
  );
  if (!rama || left() < 15000) return null;

  const pantherJpg = await genConReintentos(
    'Photoreal adult black jaguar panther side view facing RIGHT stalking walk, sleek feline whiskers long cat tail four paws, plain solid light gray #C8C8C8 studio background, sharp single animal',
    base + 2,
    'bear, gorilla, monkey, people, hybrid',
    ['flux-realism', 'flux'],
  );
  if (!pantherJpg || left() < 12000) return null;

  const monkeyJpg = await genConReintentos(
    'Photoreal tufted capuchin monkey Cebus, brown body cream chest pale face, sitting facing left, long tail, plain solid light gray #C8C8C8 studio background, sharp single animal',
    base + 3,
    'bear, cat, panther, gorilla, people',
  );
  if (!monkeyJpg || left() < 10000) return null;

  const leapJpg = await genConReintentos(
    'Photoreal tufted capuchin monkey mid-leap up and right, brown cream fur pale face arms forward, plain solid light gray #C8C8C8 studio background, sharp single animal',
    base + 4,
    'bear, cat, panther, gorilla, people',
  );
  if (!leapJpg) return null;

  const panCutRaw = await cutoutStudioGray(pantherJpg);
  const monCutRaw = await cutoutStudioGray(monkeyJpg);
  const leapCutRaw = await cutoutStudioGray(leapJpg);

  const tintJungle = async (buf) => sharp(buf)
    .modulate({ brightness: 0.98, saturation: 1.02 })
    .png()
    .toBuffer();

  const softShadow = async (pngBuf, { blur = 12, opacity = 0.45 } = {}) => {
    const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(a * opacity);
    }
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .blur(blur)
      .png()
      .toBuffer();
  };

  const panCut = await tintJungle(panCutRaw);
  const monCut = await tintJungle(monCutRaw);
  const leapCut = await tintJungle(leapCutRaw);

  const W = 1280;
  const H = 720;
  const beats = [
    { panX: 120, panY: 300, panW: 320, monX: 860, monY: 270, monW: 190, leap: false },
    { panX: 320, panY: 310, panW: 340, monX: 840, monY: 255, monW: 200, leap: false },
    { panX: 520, panY: 320, panW: 360, monX: 820, monY: 230, monW: 210, leap: false },
    { panX: 680, panY: 330, panW: 380, monX: 900, monY: 50, monW: 230, leap: true },
  ];

  const secuencia = [];
  for (const b of beats) {
    const pan = await sharp(panCut).resize({ width: b.panW }).png().toBuffer();
    const mon = await sharp(b.leap ? leapCut : monCut).resize({ width: b.monW }).png().toBuffer();
    const pSh = await softShadow(pan);
    const mSh = await softShadow(mon, { blur: 10, opacity: 0.4 });
    const pMeta = await sharp(pan).metadata();
    const mMeta = await sharp(mon).metadata();
    const leftP = Math.max(0, Math.min(W - (pMeta.width || b.panW), b.panX));
    const topP = Math.max(0, Math.min(H - (pMeta.height || 200), b.panY));
    const leftM = Math.max(0, Math.min(W - (mMeta.width || b.monW), b.monX));
    const topM = Math.max(0, Math.min(H - (mMeta.height || 200), b.monY));
    const jpg = await sharp(rama)
      .resize(W, H, { fit: 'cover' })
      .composite([
        { input: pSh, left: Math.min(W - 1, leftP + 8), top: Math.min(H - 1, topP + 14) },
        { input: mSh, left: Math.min(W - 1, leftM + 6), top: Math.min(H - 1, topM + 12) },
        { input: pan, left: leftP, top: topP },
        { input: mon, left: leftM, top: topM },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();
    secuencia.push({
      imagen_base64: jpg.toString('base64'),
      mime: 'image/jpeg',
      marca_agua_pollinations: true,
    });
  }

  return {
    secuencia,
    fuente: 'composicion-fauna-pantera-mono',
    actuacion: true,
  };
}
