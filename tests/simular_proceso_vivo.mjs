/**
 * Simulación “como usuario” del proceso Imagen/Clip IA.
 * Política VIAM: ante fallas de lógica/calidad en imagen o video del ecosistema,
 * repetir este flujo (prompt real → director → prompt corto → fetch) antes de parchear.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  expandirPromptVisual,
  promptCortoParaFlux,
  extraerElementos,
  negativosParaEscena,
  seedDesdePrompt,
  clausulaCalidadComposicion,
  clausulaProhibidos,
} from '../netlify/functions/lib/estudio-prompt-visual.mjs';
import { dirigirEscena, inferenciasLocales } from '../netlify/functions/lib/estudio-director-semantico.mjs';

const OUT = '/tmp/cursor/artifacts/simulacion-vivo';
mkdirSync(OUT, { recursive: true });

const CASOS = [
  {
    id: 'imagen-cangrejo-anguilas',
    modo: 'imagen',
    prompt:
      'un cangrejo nadando entre anguilas electricas en un río caudaloso en la montaña',
  },
  {
    id: 'imagen-espejo-manzana',
    modo: 'imagen',
    prompt:
      'una mujer afroamericana con una manzana en su mano llevándola a su boca mientras se esta observando a si misma en un espejo de cuerpo completo en su recamara',
  },
  {
    id: 'clip-ucraniana-auto',
    modo: 'clip',
    prompt:
      'Una mujer ucraniana muy elegante manejando un vehículo deportivo muy lujoso por la carretera en un camino entre una montaña, se ve la ciudad a lo lejos',
  },
];

function seccion(titulo) {
  console.log(`\n${'='.repeat(72)}\n${titulo}\n${'='.repeat(72)}`);
}

async function simularCaso(caso) {
  seccion(`CASO ${caso.id} (${caso.modo})`);
  console.log('PROMPT USUARIO:\n', caso.prompt);

  console.log('\n--- 1) Tokens / elementos locales ---');
  const elems = extraerElementos(caso.prompt);
  console.log('extraerElementos:', elems);

  console.log('\n--- 2) Inferencias locales (antes del LLM) ---');
  const inferLocal = inferenciasLocales(caso.prompt);
  console.log(inferLocal.length ? inferLocal.map((x, i) => `  [${i}] ${x}`).join('\n') : '  (ninguna)');

  console.log('\n--- 3) Director Semántico (dirigirEscena) ---');
  const t0 = Date.now();
  const director = await dirigirEscena(caso.prompt, {
    modalidad: caso.modo === 'clip' ? 'clip' : 'imagen',
  });
  console.log(`vía: ${director.via} · ${Date.now() - t0} ms`);
  console.log('resumen_es:', director.resumen_es);
  console.log('intencion:', director.intencion);
  console.log('conjuntos:', JSON.stringify(director.conjuntos, null, 2));
  console.log('inferencias:', director.inferencias);
  console.log('prohibidos:', director.prohibidos);
  console.log('brief_visual_en (len=%d):\n%s', director.brief_visual_en.length, director.brief_visual_en.slice(0, 500));

  console.log('\n--- 4) expandirPromptVisual (lo que ve Imagen/Clip) ---');
  const t1 = Date.now();
  const expansion = await expandirPromptVisual(caso.prompt, { modo: caso.modo });
  console.log(`vía: ${expansion.via} · ${Date.now() - t1} ms`);
  console.log('resumen UI (textoDirectorStatus):', expansion.resumen || expansion.director?.resumen_es || '(vacío)');
  console.log('promptEn LEN:', expansion.promptEn.length);
  console.log('promptEn:\n', expansion.promptEn);

  console.log('\n--- 5) Lo que REALMENTE llega a Pollinations (prompt corto) ---');
  const corto = promptCortoParaFlux(caso.prompt, expansion.promptEn);
  const calidad = clausulaCalidadComposicion(caso.prompt);
  const prohib = clausulaProhibidos(caso.prompt);
  console.log('calidad LEN:', calidad.length);
  console.log('prohibidos LEN:', prohib.length);
  console.log('corto LEN:', corto.length, '/ límite 850');
  console.log('corto COMPLETO:\n', corto);

  // ¿Qué partes clave del prompt usuario sobreviven en el corto?
  const claves = caso.id.startsWith('imagen')
    ? ['manzana', 'apple', 'espejo', 'mirror', 'recamara', 'bedroom', 'afro', 'boca', 'mouth', 'cuerpo completo', 'full']
    : ['ucranian', 'ukrain', 'vehicul', 'car', 'deportiv', 'sport', 'montañ', 'mountain', 'ciudad', 'city', 'carretera', 'road', 'lujoso', 'luxury', 'manej', 'driv'];
  console.log('\n¿Sobrevive cada clave en el prompt CORTO?');
  for (const k of claves) {
    const ok = new RegExp(k, 'i').test(corto);
    console.log(`  ${ok ? 'OK ' : 'FALTA'} ${k}`);
  }
  console.log('\n¿Sobrevive cada clave en promptEn largo?');
  for (const k of claves) {
    const ok = new RegExp(k, 'i').test(expansion.promptEn);
    console.log(`  ${ok ? 'OK ' : 'FALTA'} ${k}`);
  }

  const seed = seedDesdePrompt(caso.modo === 'clip' ? `clip:${caso.prompt}` : caso.prompt);
  const negativo = negativosParaEscena(caso.prompt);
  console.log('\n--- 6) Request Pollinations (params) ---');
  console.log('seed:', seed);
  console.log('negative LEN:', negativo.length);
  console.log('negative:', negativo.slice(0, 300), '...');

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(corto)}?width=1280&height=720&nologo=true&private=true&nofeed=true&enhance=false&model=flux&seed=${seed}&negative=${encodeURIComponent(negativo)}&referrer=video_diamante`;
  console.log('URL LEN:', url.length);

  console.log('\n--- 7) Fetch real a Pollinations (como el software) ---');
  const t2 = Date.now();
  let fetchInfo = { ok: false };
  try {
    const r = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(55000),
    });
    const buf = Buffer.from(await r.arrayBuffer());
    fetchInfo = {
      ok: r.ok,
      status: r.status,
      ctype: r.headers.get('content-type'),
      bytes: buf.length,
      ms: Date.now() - t2,
    };
    console.log(fetchInfo);
    if (r.ok && buf.length > 8000) {
      const path = `${OUT}/${caso.id}-pollinations-flux.jpg`;
      writeFileSync(path, buf);
      console.log('Guardada:', path);
      fetchInfo.path = path;
    }
  } catch (err) {
    fetchInfo = { ok: false, error: String(err?.message || err), ms: Date.now() - t2 };
    console.log('Fetch falló:', fetchInfo);
  }

  const reporte = {
    id: caso.id,
    modo: caso.modo,
    prompt: caso.prompt,
    elementos: elems,
    inferencias_locales: inferLocal,
    director: {
      via: director.via,
      resumen_es: director.resumen_es,
      conjuntos: director.conjuntos,
      inferencias: director.inferencias,
    },
    expansion: {
      via: expansion.via,
      resumen: expansion.resumen,
      promptEn_len: expansion.promptEn.length,
      promptEn: expansion.promptEn,
    },
    pollinations: {
      corto_len: corto.length,
      corto,
      calidad_len: calidad.length,
      claves_en_corto: Object.fromEntries(claves.map((k) => [k, new RegExp(k, 'i').test(corto)])),
      claves_en_largo: Object.fromEntries(claves.map((k) => [k, new RegExp(k, 'i').test(expansion.promptEn)])),
      seed,
      fetch: fetchInfo,
    },
  };
  writeFileSync(`${OUT}/${caso.id}-reporte.json`, JSON.stringify(reporte, null, 2));
  return reporte;
}

const reportes = [];
for (const caso of CASOS) {
  reportes.push(await simularCaso(caso));
}

seccion('RESUMEN HALLAZGOS');
for (const r of reportes) {
  const faltanCorto = Object.entries(r.pollinations.claves_en_corto).filter(([, v]) => !v).map(([k]) => k);
  const faltanLargo = Object.entries(r.pollinations.claves_en_largo).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n[${r.id}]`);
  console.log('  Director resumen:', r.director.resumen_es);
  console.log('  corto LEN:', r.pollinations.corto_len);
  console.log('  Faltan en CORTO:', faltanCorto.join(', ') || '(nada)');
  console.log('  Faltan en LARGO:', faltanLargo.join(', ') || '(nada)');
  console.log('  Fetch:', r.pollinations.fetch);
}

writeFileSync(`${OUT}/resumen.json`, JSON.stringify(reportes, null, 2));
console.log(`\nReportes en ${OUT}`);
