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

const catalog = readFileSync(join(cn, "src/lib/cursos-educativos.ts"), "utf8");
assert.match(catalog, /Escuela de principios vitalicios/);
assert.match(catalog, /educación contínua/);
assert.match(catalog, /PRECIO_RECUPERACION_MXN = 200/);
assert.match(catalog, /el-cuerpo-escucha/);

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

console.log("ok: escuela en ContacNeed admin + aula pública 200 MXN");
