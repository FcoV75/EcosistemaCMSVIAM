import {
  CURSOS_EDUCATIVOS,
  ESCUELA_LEMA,
  ESCUELA_TITULO,
  PRECIO_RECUPERACION_MXN,
  etiquetaCuota,
  tituloDeCurso,
  type SesionViva,
} from './cursos-educativos'

export type HechosCurso = {
  slug: string
  titulo: string
  estado: 'dado' | 'programado'
  resumen: string
}

export type HechosSesion = {
  id: string
  slug: string
  titulo: string
  fecha: string
  hora: string
  modalidad: string
  cuota: string
  zoomOLugar: string
  notas: string
}

export type HechosEscuela = {
  titulo: string
  lema: string
  recuperacionMxn: number
  cursos: HechosCurso[]
  sesiones: HechosSesion[]
}

export function esPreguntaEscuela(question: string) {
  const q = question.toLowerCase()
  return (
    q.includes('escuela') ||
    q.includes('curso') ||
    q.includes('inscrib') ||
    q.includes('informe') ||
    q.includes('léete') ||
    q.includes('leete') ||
    q.includes('cuerpo escucha') ||
    (q.includes('cuerpo') && q.includes('escucha')) ||
    q.includes('recuperación') ||
    q.includes('recuperacion') ||
    q.includes('impartici') ||
    (q.includes('zoom') &&
      (q.includes('sesión') || q.includes('sesion') || q.includes('vivo') || q.includes('clase'))) ||
    (q.includes('cuota') &&
      (q.includes('vivo') || q.includes('curso') || q.includes('escuela') || q.includes('inscrib')))
  )
}

export function hechosDesdeCatalogo(sesiones: SesionViva[] = []): HechosEscuela {
  return {
    titulo: ESCUELA_TITULO,
    lema: ESCUELA_LEMA,
    recuperacionMxn: PRECIO_RECUPERACION_MXN,
    cursos: CURSOS_EDUCATIVOS.map((curso) => ({
      slug: curso.slug,
      titulo: curso.titulo,
      estado: curso.estado,
      resumen: curso.resumen,
    })),
    sesiones: sesiones.filter(Boolean).map((sesion) => ({
      id: sesion.id,
      slug: sesion.slug,
      titulo: (sesion.titulo || tituloDeCurso(sesion.slug)).trim(),
      fecha: (sesion.fecha || '').trim(),
      hora: (sesion.hora || '').trim(),
      modalidad: (sesion.modalidad || '').trim(),
      cuota: (sesion.cuotaMxn || '').trim(),
      zoomOLugar: (sesion.lugarOEnlace || '').trim(),
      notas: (sesion.notas || '').trim(),
    })),
  }
}

function cursoMencionado(hechos: HechosEscuela, pregunta: string) {
  const q = pregunta.toLowerCase()
  return (
    hechos.cursos.find((curso) => {
      const titulo = curso.titulo.toLowerCase()
      const slug = curso.slug.toLowerCase()
      return q.includes(titulo) || q.includes(slug) || q.includes(slug.replace(/-/g, ' '))
    }) ?? null
  )
}

function lineaSesion(sesion: HechosSesion) {
  const cuando = [sesion.fecha, sesion.hora].filter(Boolean).join(' · ') || 'fecha por confirmar'
  const cuota = sesion.cuota
    ? etiquetaCuota(sesion.cuota).replace(/^ · /, '')
    : 'cuota en vivo aún no publicada'
  const lugar = sesion.zoomOLugar
    ? sesion.zoomOLugar
    : 'el enlace de Zoom o el lugar solo aparece cuando el docente lo anota en la ficha; no se inventa'
  return `${sesion.titulo}: ${cuando} · ${sesion.modalidad || 'modalidad por confirmar'} · ${cuota}. Acceso: ${lugar}.`
}

export function redactarInformeEscuela(hechos: HechosEscuela, pregunta: string) {
  const curso = cursoMencionado(hechos, pregunta)
  const dados = hechos.cursos.filter((item) => item.estado === 'dado')
  const titulosDados = dados.map((item) => item.titulo).join(' y ')
  const sesionesDeCurso = curso
    ? hechos.sesiones.filter((sesion) => sesion.slug === curso.slug)
    : hechos.sesiones
  const sesiones = sesionesDeCurso.length ? sesionesDeCurso : hechos.sesiones

  const partes: string[] = []
  partes.push(
    `${hechos.titulo}: ${hechos.lema} Los cursos ya impartidos (${titulosDados || 'aún sin publicar'}) se observan y descargan con cuota de recuperación de ${hechos.recuperacionMxn} MXN, después de iniciar sesión. Eso no es ContacNeed PRO (300 MXN al mes).`,
  )

  if (curso) {
    partes.push(
      `Sobre «${curso.titulo}»: ${curso.resumen}${
        curso.estado === 'programado'
          ? ' Todavía no se abre el material grabado.'
          : ` Ya se impartió; la recuperación es ${hechos.recuperacionMxn} MXN.`
      }`,
    )
  }

  if (sesiones.length) {
    partes.push(`Fechas en vivo publicadas: ${sesiones.map(lineaSesion).join(' ')}`)
  } else {
    partes.push(
      'No hay una fecha en vivo publicada ahora. No invento Zoom, hora ni cuota de impartición: eso solo se dice cuando aparece en la ficha de la sesión.',
    )
  }

  partes.push(
    'Para dejar tu solicitud al docente, usa «Pedir informes» o «Quiero inscribirme» en /escuela. La escuela camina al lado del médico o el terapeuta; no los sustituye.',
  )

  return partes.join(' ')
}
