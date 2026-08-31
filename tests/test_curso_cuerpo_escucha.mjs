import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cn = join(root, "ContacNeed - Arquitectura Modular Diamante Estabilizada");

assert.ok(existsSync(join(cn, "src/routes/escuela.tsx")), "falta ruta /escuela");
assert.ok(existsSync(join(cn, "src/routes/escuela.$slug.tsx")), "falta ruta /escuela/$slug");
assert.ok(existsSync(join(cn, "src/components/admin/CursosEducativosAdminPanel.tsx")), "falta panel admin");
assert.ok(
  existsSync(join(cn, "public/cursos-assets/el-cuerpo-escucha/01-portada-cuerpo-escucha.jpg")),
  "falta portada",
);
assert.ok(
  existsSync(join(cn, "public/cursos-assets/el-cuerpo-escucha/paquete-recuperacion-k7m2q9w4.zip")),
  "falta paquete descargable",
);
assert.ok(
  existsSync(join(cn, "public/cursos-assets/leete-y-lee/01-portada-leete-y-lee.jpg")),
  "falta portada Léete y lee",
);
assert.ok(
  existsSync(join(cn, "public/cursos-assets/leete-y-lee/paquete-recuperacion-n4p8r2x6.zip")),
  "falta paquete Léete y lee",
);
assert.ok(existsSync(join(cn, "content/cursos/leete-y-lee/index.html")), "faltan lecciones Léete y lee");
assert.ok(existsSync(join(root, "cursos/leete-y-lee/index.html")), "falta teaser CMS Léete y lee");
assert.ok(
  existsSync(join(cn, "public/cursos-assets/la-pausa-que-decide/01-portada-pausa-decide.jpg")),
  "falta portada La pausa que decide",
);
assert.ok(
  existsSync(join(cn, "public/cursos-assets/la-pausa-que-decide/paquete-recuperacion-t8w3n6q1.zip")),
  "falta paquete La pausa que decide",
);
assert.ok(existsSync(join(cn, "content/cursos/la-pausa-que-decide/index.html")), "faltan lecciones La pausa que decide");
assert.ok(existsSync(join(root, "cursos/la-pausa-que-decide/index.html")), "falta teaser CMS La pausa que decide");

const catalog = readFileSync(join(cn, "src/lib/cursos-educativos.ts"), "utf8");
assert.match(catalog, /Escuela de principios vitalicios/);
assert.match(catalog, /educación cont[ií]nua/);
assert.match(catalog, /PRECIO_RECUPERACION_MXN = 200/);
assert.match(catalog, /el-cuerpo-escucha/);
assert.match(catalog, /leete-y-lee/);
assert.match(catalog, /Léete y lee/);
assert.match(catalog, /la-pausa-que-decide/);
assert.match(catalog, /La pausa que decide/);
assert.match(catalog, /la-palabra-que-no-obliga/);
assert.match(catalog, /La palabra que no obliga/);

const bundled = readFileSync(join(cn, "src/server/cursos-bundled.ts"), "utf8");
assert.match(bundled, /leete-y-lee/);
assert.match(bundled, /paquete-recuperacion-n4p8r2x6/);
assert.match(bundled, /la-pausa-que-decide/);
assert.match(bundled, /paquete-recuperacion-t8w3n6q1/);
assert.match(bundled, /la-palabra-que-no-obliga/);
assert.match(bundled, /paquete-recuperacion-p4k7m2s9/);

const lecciones = readFileSync(join(cn, "content/cursos/leete-y-lee/index.html"), "utf8");
assert.match(lecciones, /Mirar con precisión/);
assert.match(lecciones, /La cadena invisible/);
assert.doesNotMatch(lecciones, /transcripción literal/);
assert.match(lecciones, /al lado/);

const pausa = readFileSync(join(cn, "content/cursos/la-pausa-que-decide/index.html"), "utf8");
assert.match(pausa, /Dejar de reaccionar/);
assert.match(pausa, /Ver lo que no se ve/);
assert.match(pausa, /al lado/);
assert.doesNotMatch(pausa, /transcripción literal/);

const teaserPausa = readFileSync(join(root, "cursos/la-pausa-que-decide/index.html"), "utf8");
assert.match(teaserPausa, /contacneed.com\/escuela\/la-pausa-que-decide/);
assert.doesNotMatch(teaserPausa, /Etapa 1 · Dejar de reaccionar/);
assert.match(pausa, /Jehová/);
assert.match(pausa, /\/cursos-assets\/la-pausa-que-decide\//);

assert.ok(
  existsSync(join(cn, "public/cursos-assets/la-palabra-que-no-obliga/01-portada-palabra-no-obliga.jpg")),
  "falta portada La palabra que no obliga",
);
assert.ok(
  existsSync(join(cn, "public/cursos-assets/la-palabra-que-no-obliga/paquete-recuperacion-p4k7m2s9.zip")),
  "falta paquete La palabra que no obliga",
);
assert.ok(existsSync(join(cn, "content/cursos/la-palabra-que-no-obliga/index.html")), "faltan lecciones La palabra que no obliga");
assert.ok(existsSync(join(root, "cursos/la-palabra-que-no-obliga/index.html")), "falta teaser CMS La palabra que no obliga");

const palabra = readFileSync(join(cn, "content/cursos/la-palabra-que-no-obliga/index.html"), "utf8");
assert.match(palabra, /Oír antes de mover/);
assert.match(palabra, /Lámpara, no incendio/);
assert.match(palabra, /al lado/);
assert.match(palabra, /Jehová/);
assert.doesNotMatch(palabra, /transcripción literal/);
assert.match(palabra, /\/cursos-assets\/la-palabra-que-no-obliga\//);

const teaserPalabra = readFileSync(join(root, "cursos/la-palabra-que-no-obliga/index.html"), "utf8");
assert.match(teaserPalabra, /contacneed.com\/escuela\/la-palabra-que-no-obliga/);
assert.doesNotMatch(teaserPalabra, /Etapa 1 · Oír antes de mover/);

const admin = readFileSync(join(cn, "src/routes/admin.tsx"), "utf8");
assert.match(admin, /Cursos Educativos/);
assert.match(admin, /CursosEducativosAdminPanel/);

const home = readFileSync(join(root, "index.html"), "utf8");
assert.doesNotMatch(home, /Abrir las lecciones/);

const cmsCatalog = readFileSync(join(root, "cursos/index.html"), "utf8");
assert.match(cmsCatalog, /Escuela de principios vitalicios/);
assert.match(cmsCatalog, /contacneed.com\/escuela/);

const sidebar = readFileSync(join(cn, "src/components/SidebarNav.tsx"), "utf8");
assert.match(sidebar, /to="\/escuela"/);

const escuela = readFileSync(join(cn, "src/routes/escuela.tsx"), "utf8");
assert.match(escuela, /sesion\.titulo/);
assert.match(escuela, /AccionesEscuela/);
assert.match(escuela, /Pedir informes|Quiero inscribirme|Ver e informes/);

const shell = readFileSync(join(cn, "src/components/AppShell.tsx"), "utf8");
assert.match(shell, /AmigosEnLinea/);
assert.match(shell, /lg:overflow-y-auto/);
assert.doesNotMatch(shell, /lg:sticky lg:top-28/);
assert.ok(existsSync(join(cn, "src/components/AmigosEnLinea.tsx")), "falta AmigosEnLinea");
assert.match(readFileSync(join(cn, "src/server/social.functions.ts"), "utf8"), /getAmigosEnLineaFn/);

const support = readFileSync(join(cn, "src/server/support.functions.ts"), "utf8");
assert.match(support, /Escuela de principios vitalicios/);
assert.match(support, /esPreguntaEscuela/);
assert.match(support, /redactarInformeEscuela/);
assert.match(support, /Nunca inventes precios|NUNCA inventes precios/);
assert.match(support, /La pausa que decide/);
assert.match(support, /La palabra que no obliga/);

const informes = readFileSync(join(cn, "src/lib/informes-escuela.ts"), "utf8");
assert.match(informes, /recuperacionMxn: PRECIO_RECUPERACION_MXN/);
assert.match(informes, /no se inventa/);
assert.match(informes, /no es ContacNeed PRO/);

const auth = readFileSync(join(cn, "src/lib/auth.ts"), "utf8");
assert.match(auth, /esCuentaDocenteEscuela/);
assert.match(auth, /jfcovaoso@gmail.com/);
assert.match(auth, /es_fundador/);

const acceso = readFileSync(join(cn, "src/server/cursos-educativos.functions.ts"), "utf8");
assert.match(acceso, /getCursoDocumentoAdminFn/);
assert.match(acceso, /materialDeCursoDado/);
assert.doesNotMatch(acceso, /export async function cargarHechosEscuela/);
assert.doesNotMatch(acceso, /export async function usuarioTieneCurso/);

const adminPanel = readFileSync(join(cn, "src/components/admin/CursosEducativosAdminPanel.tsx"), "utf8");
assert.match(adminPanel, /getCursoDocumentoAdminFn/);
assert.match(adminPanel, /Abrir cursos/);
assert.match(adminPanel, /estado === 'dado'/);
assert.doesNotMatch(escuela, /Abrir como docente/);

const bell = readFileSync(join(cn, "src/components/NotificationsBell.tsx"), "utf8");
assert.match(bell, /\/avisos/);
assert.doesNotMatch(bell, /to="\/mensajes"/);
assert.ok(existsSync(join(cn, "src/routes/avisos.tsx")), "falta /avisos");
assert.match(escuela, /lugarOEnlace|LugarSesion/);

console.log("ok: escuela en ContacNeed admin + aula pública 200 MXN");
