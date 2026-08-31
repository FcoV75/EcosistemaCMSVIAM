export const PRODUCTO_ESCUELA = 'escuela_principios'
export const PLAN_RECUPERACION = 'recuperacion'
export const PRECIO_RECUPERACION_MXN = 200
export const PRECIO_RECUPERACION_CENTAVOS = 20000

export const ESCUELA_TITULO = 'Escuela de principios vitalicios'
export const ESCUELA_LEMA =
  'Tu educación continua de vida y salud física y mental.'

export type EstadoCurso = 'dado' | 'programado'
export type ModalidadImparticion = 'Zoom' | 'Presencial' | 'Zoom y presencial'

export type CursoEducativo = {
  slug: string
  titulo: string
  estado: EstadoCurso
  resumen: string
  etapas: number
  modalidad: ModalidadImparticion
  fechaDado?: string
  fechaProgramada?: string
  cuotaImparticion?: string
  portada: string
}

export const CURSOS_EDUCATIVOS: CursoEducativo[] = [
  {
    slug: 'el-cuerpo-escucha',
    titulo: 'El cuerpo escucha',
    estado: 'dado',
    resumen:
      'Ocho etapas para entender cómo el pensamiento, la emoción y la voz interior conversan con el organismo. Ciencia seria, práctica cotidiana y un puente bíblico equilibrado.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-08-22',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/el-cuerpo-escucha/01-portada-cuerpo-escucha.jpg',
  },
  {
    slug: 'leete-y-lee',
    titulo: 'Léete y lee',
    estado: 'dado',
    resumen:
      'Ocho etapas para mirarte con precisión y leer a los demás sin inventarles la novela. Hecho e interpretación, desencadenantes, límites y voz propia.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-08-22',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/leete-y-lee/01-portada-leete-y-lee.jpg',
  },
  {
    slug: 'la-pausa-que-decide',
    titulo: 'La pausa que decide',
    estado: 'dado',
    resumen:
      'Ocho etapas para dejar de reaccionar, ver lo que no se ve y decidir sin la tormenta. El problema como maestro, influir sin empujar y diseñar el día con serenidad.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-08-31',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/la-pausa-que-decide/01-portada-pausa-decide.jpg',
  },
  {
    slug: 'la-palabra-que-no-obliga',
    titulo: 'La palabra que no obliga',
    estado: 'dado',
    resumen:
      'Ocho etapas para convencer sin quitarle a nadie la voluntad. Oír, depositar confianza, gobernar el clima y hablar como lámpara, no como incendio.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-08-31',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/la-palabra-que-no-obliga/01-portada-palabra-no-obliga.jpg',
  },
  {
    slug: 'proximo-itinerario',
    titulo: 'Próximo itinerario',
    estado: 'programado',
    resumen:
      'El siguiente audiolibro se convertirá en curso por etapas. Queda anunciado para generar expectativa: mismo método, de menor a mayor.',
    etapas: 0,
    modalidad: 'Zoom y presencial',
    fechaProgramada: 'Por anunciar',
    cuotaImparticion: 'Se publicará con la fecha de impartición.',
    portada: '/cursos-assets/leete-y-lee/10-ciclo-aprender.jpg',
  },
]

export function getCursoBySlug(slug: string) {
  return CURSOS_EDUCATIVOS.find((curso) => curso.slug === slug) ?? null
}

export function tituloDeCurso(slug: string) {
  return getCursoBySlug(slug)?.titulo || 'Curso de la escuela'
}

export function etiquetaCuota(cuota?: string) {
  const raw = (cuota || '').trim()
  if (!raw) return ''
  const limpia = raw.replace(/^\$+\s*/, '').replace(/\s*mxn\.?$/i, '').trim()
  if (!limpia) return ''
  return ` · $${limpia} MXN`
}

export function cursosPublicos() {
  return CURSOS_EDUCATIVOS.filter((curso) => curso.estado === 'dado' || curso.estado === 'programado')
}

export type SesionViva = {
  id: string
  slug: string
  titulo?: string
  fecha: string
  hora: string
  modalidad: ModalidadImparticion
  cuotaMxn: string
  lugarOEnlace: string
  notas: string
}

export function randomIntegrationSuffix() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < 8; i++) out += letters[Math.floor(Math.random() * letters.length)]
  return out
}
