import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const radio = fs.readFileSync(path.join(root, 'Assets/radio.js'), 'utf8');
const m = radio.match(/"Instrumentales_con_Frecuencia": \[([\s\S]*?)\]\s*,\s*"Regional/);
const urls = [...m[1].matchAll(/"(https:[^"]+)"/g)].map((x) => x[1]);
const out = path.join(root, 'netlify/functions/lib/nexus-instrumentales.mjs');
fs.writeFileSync(out, `export const INSTRUMENTALES_CON_FRECUENCIA = ${JSON.stringify(urls, null, 2)};\n`);
console.log(`Wrote ${urls.length} tracks to ${out}`);
