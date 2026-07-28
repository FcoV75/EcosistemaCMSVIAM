import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { libroPorSlug } from './lib/libros-catalog.mjs';
import { verifyDownloadToken, getSessionSecret } from './lib/ecosistema-auth.mjs';
import { corsPreflight } from './lib/railway-guard.mjs';

const ALLOWED = new Set([
  'Memorias_Peligrosas.pdf',
  'Programacion_Fatal.pdf',
  'Litigio_Mortal.pdf',
  'Busqueda_Impactante.pdf',
  'EBook_ISometricos.pdf',
  'Poesias_del_Corazon.pdf',
]);

/** PDFs públicos (sin token): cotizaciones y materiales de marketing. */
const PUBLIC_ALLOWED = new Set([
  'Cotizacion_IAVIAMMusicPublicidad.pdf',
]);

async function leerPdf(archivo) {
  const candidatos = [
    join(process.cwd(), 'Assets', 'Docs', archivo),
    join(process.cwd(), '..', 'Assets', 'Docs', archivo),
  ];
  for (const ruta of candidatos) {
    try {
      return await readFile(ruta);
    } catch {
      /* siguiente */
    }
  }
  throw new Error('Archivo no encontrado en el servidor.');
}

function pdfResponse(bin, archivo, { inline = false, cache = 'private, no-store' } = {}) {
  const disposition = inline ? 'inline' : 'attachment';
  return new Response(bin, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${archivo}"`,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const archivoParam = url.searchParams.get('archivo') || '';
  const inline = url.searchParams.get('inline') === '1';

  // Cotización y otros PDF públicos: no requieren compra/token.
  if (PUBLIC_ALLOWED.has(archivoParam)) {
    try {
      const bin = await leerPdf(archivoParam);
      return pdfResponse(bin, archivoParam, {
        inline,
        cache: 'public, max-age=86400',
      });
    } catch (err) {
      console.error('download-libro público:', err);
      return new Response('No se pudo entregar el archivo.', { status: 500 });
    }
  }

  const secret = getSessionSecret();
  if (!secret) {
    return new Response('Servicio no configurado.', { status: 503 });
  }

  const payload = verifyDownloadToken(token, secret);
  if (!payload) {
    return new Response(
      'Acceso protegido. Compra la obra en Obras Literarias y verifica tu código CMS-XXXXXX en la sección de descargas del CMS.',
      { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  let archivo = payload.archivo || archivoParam;
  if (!archivo && payload.libro) {
    archivo = libroPorSlug(payload.libro)?.archivo;
  }
  if (!archivo || !ALLOWED.has(archivo)) {
    return new Response('Libro no autorizado.', { status: 403 });
  }

  if (payload.archivo && archivoParam && payload.archivo !== archivoParam) {
    return new Response('Token no coincide con el archivo solicitado.', { status: 403 });
  }

  try {
    const bin = await leerPdf(archivo);
    return pdfResponse(bin, archivo, { inline });
  } catch (err) {
    console.error('download-libro:', err);
    return new Response('No se pudo entregar el libro en este momento.', { status: 500 });
  }
};
