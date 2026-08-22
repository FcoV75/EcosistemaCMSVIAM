import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const course = join(root, "cursos/el-cuerpo-escucha");

const requiredFiles = [
  "index.html",
  "diapositivas.html",
  "slides.js",
  "guia-docente.md"
];
for (const file of requiredFiles) {
  assert.ok(existsSync(join(course, file)), `falta ${file}`);
}

const slidesJs = readFileSync(join(course, "slides.js"), "utf8");
const fn = new Function(`${slidesJs}; return window.CURSO_SLIDES;`);
globalThis.window = {};
const slides = fn();
assert.ok(Array.isArray(slides) && slides.length >= 40, "deben existir al menos 40 diapositivas");

const fields = ["etapa", "kicker", "title", "text", "note", "image", "alt"];
for (const [index, slide] of slides.entries()) {
  for (const field of fields) {
    assert.ok(slide[field], `slide ${index + 1} sin ${field}`);
  }
  assert.ok(existsSync(join(course, slide.image)), `imagen ausente: ${slide.image}`);
}

const book = readFileSync(join(course, "index.html"), "utf8");
assert.match(book, /Regla de oro/);
assert.match(book, /Proverbios 17:22/);
assert.match(book, /id="e8"/);
assert.match(book, /nunca en su lugar/);

const home = readFileSync(join(root, "index.html"), "utf8");
assert.match(home, /cursos\/el-cuerpo-escucha/);

console.log(`ok: ${slides.length} diapositivas y lecciones enlazadas`);
