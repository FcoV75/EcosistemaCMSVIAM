export const LIBROS = {
  'memorias-peligrosas': {
    archivo: 'Memorias_Peligrosas.pdf',
    titulo: 'Memorias Peligrosas',
  },
  'programacion-fatal': {
    archivo: 'Programacion_Fatal.pdf',
    titulo: 'Programación Fatal',
  },
  'litigio-mortal': {
    archivo: 'Litigio_Mortal.pdf',
    titulo: 'Litigio Mortal',
  },
  'busqueda-impactante': {
    archivo: 'Busqueda_Impactante.pdf',
    titulo: 'Búsqueda Impactante',
  },
  'ebook-isometricos': {
    archivo: 'EBook_ISometricos.pdf',
    titulo: 'Libro Técnico Profesional',
  },
  'poesias-del-corazon': {
    archivo: 'Poesias_del_Corazon.pdf',
    titulo: 'Poesías del Corazón',
  },
};

export function libroPorSlug(slug) {
  return LIBROS[String(slug || '').trim().toLowerCase()] || null;
}

export function libroPorArchivo(archivo) {
  const nombre = String(archivo || '').trim();
  return Object.entries(LIBROS).find(([, meta]) => meta.archivo === nombre) || null;
}

export function slugDesdeTitulo(titulo) {
  const t = String(titulo || '').trim();
  const entry = Object.entries(LIBROS).find(([, meta]) => meta.titulo === t);
  return entry ? entry[0] : null;
}
