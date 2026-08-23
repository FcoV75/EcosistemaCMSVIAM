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

const catalog = readFileSync(join(cn, "src/lib/cursos-educativos.ts"), "utf8");
assert.match(catalog, /Escuela de principios vitalicios/);
assert.match(catalog, /educación contínua/);
assert.match(catalog, /PRECIO_RECUPERACION_MXN = 200/);
assert.match(catalog, /el-cuerpo-escucha/);
assert.match(catalog, /leete-y-lee/);
assert.match(catalog, /Léete y lee/);

const bundled = readFileSync(join(cn, "src/server/cursos-bundled.ts"), "utf8");
assert.match(bundled, /leete-y-lee/);
assert.match(bundled, /paquete-recuperacion-n4p8r2x6/);

const lecciones = readFileSync(join(cn, "content/cursos/leete-y-lee/index.html"), "utf8");
assert.match(lecciones, /Mirar con precisión/);
assert.match(lecciones, /La cadena invisible/);
assert.doesNotMatch(lecciones, /transcripción literal/);
assert.match(lecciones, /al lado/);

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

const informes = readFileSync(join(cn, "src/lib/informes-escuela.ts"), "utf8");
assert.match(informes, /recuperacionMxn: PRECIO_RECUPERACION_MXN/);
assert.match(informes, /no se inventa/);
assert.match(informes, /no es ContacNeed PRO/);

const auth = readFileSync(join(cn, "src/lib/auth.ts"), "utf8");
assert.match(auth, /esCuentaDocenteEscuela/);
assert.match(auth, /jfcovaoso@gmail.com/);
assert.match(auth, /es_fundador/);

const acceso = readFileSync(join(cn, "src/server/cursos-educativos.functions.ts"), "utf8");
assert.match(acceso, /esDocenteEscuelaActual/);
assert.match(acceso, /docente.esDocente \|\| comprado/);
assert.match(acceso, /cargarHechosEscuela/);

const bell = readFileSync(join(cn, "src/components/NotificationsBell.tsx"), "utf8");
assert.match(bell, /\/avisos/);
assert.doesNotMatch(bell, /to="\/mensajes"/);
assert.ok(existsSync(join(cn, "src/routes/avisos.tsx")), "falta /avisos");
assert.match(escuela, /lugarOEnlace|LugarSesion/);

console.log("ok: escuela en ContacNeed admin + aula pública 200 MXN");
