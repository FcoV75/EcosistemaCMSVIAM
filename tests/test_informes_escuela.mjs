import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cn = join(root, "ContacNeed - Arquitectura Modular Diamante Estabilizada");

const informes = readFileSync(join(cn, "src/lib/informes-escuela.ts"), "utf8");
assert.match(informes, /export function esPreguntaEscuela/);
assert.match(informes, /export function redactarInformeEscuela/);
assert.match(informes, /PRECIO_RECUPERACION_MXN/);
assert.match(informes, /300 MXN al mes/);
assert.match(informes, /no se inventa/);
assert.match(informes, /ContacNeed PRO/);

const enlaces = readFileSync(join(cn, "src/lib/avisos-enlaces.ts"), "utf8");
assert.match(enlaces, /\/escuela\/\$slug/);
assert.match(enlaces, /\/admin/);
assert.match(enlaces, /\/avisos/);
assert.doesNotMatch(enlaces, /window\.location/);

const support = readFileSync(join(cn, "src/server/support.functions.ts"), "utf8");
assert.doesNotMatch(support, /cursos-educativos\.functions/);
assert.match(support, /cargarHechosEscuela/);
assert.match(support, /escuela_agenda/);
const escuelaIdx = support.indexOf("esPreguntaEscuela(question)");
const proIdx = support.indexOf("FAQ_ENTRIES.pro");
assert.ok(escuelaIdx > 0 && escuelaIdx < proIdx, "la escuela debe contestarse antes que PRO");

const bell = readFileSync(join(cn, "src/components/NotificationsBell.tsx"), "utf8");
assert.match(bell, /EnlaceAviso/);
assert.match(bell, /Ver todos los avisos/);

console.log("ok: informes de escuela sin inventar y avisos sin rebote");
