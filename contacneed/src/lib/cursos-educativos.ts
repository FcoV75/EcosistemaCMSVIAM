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
    slug: 'circulo-cms-plus-membresias',
    titulo: 'Círculo CMS-Plus Membresías',
    estado: 'dado',
    resumen:
      'Diapositivas listas para Zoom: utilidad y beneficios de Plata, Oro, Platino y Diamante. Insignia, créditos, círculo de beneficiarios, Calendly y renovación con upgrade.',
    etapas: 4,
    modalidad: 'Zoom',
    fechaDado: '2026-11-13',
    cuotaImparticion: 'Material de recuperación para presentar el Círculo CMS-Plus en vivo o en pantalla compartida.',
    portada: '/cursos-assets/circulo-cms-plus-membresias/01-portada-cms-plus.png',
  },
  {
    slug: 'no-es-dinero-es-energia',
    titulo: 'No es dinero, es energía',
    estado: 'dado',
    resumen:
      'Ocho etapas para dejar de pelear con el dinero como ídolo y gobernar el flujo: valor, escasez heredada, circulación, gratitud y mayordomía práctica.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-20',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/no-es-dinero-es-energia/01-portada-energia.jpg',
  },
  {
    slug: 'el-salto-que-despierta',
    titulo: 'El salto que despierta',
    estado: 'dado',
    resumen:
      'Ocho etapas para habitar el otro lado del cambio: umbral, identidad nueva, soltar la versión pequeña, responsabilidad de nivel y práctica del maestro callado.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-20',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/el-salto-que-despierta/01-portada-salto.jpg',
  },
  {
    slug: 'la-mente-que-endurece',
    titulo: 'La mente que endurece',
    estado: 'dado',
    resumen:
      'Ocho etapas para callosar la voluntad: comodidad que engaña, práctica difícil, inventario de excusas, fracaso útil y disciplina sin espectáculo.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-20',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/la-mente-que-endurece/01-portada-mente-endurece.jpg',
  },
  {
    slug: 'lo-que-decide-sin-ti',
    titulo: 'Lo que decide sin ti',
    estado: 'dado',
    resumen:
      'Ocho etapas para ver el piloto automático: creencias bajo el suelo, filtro magnético, historia narrada, reescritura y decidir con los dos niveles de la mente.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-20',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/lo-que-decide-sin-ti/01-portada-decide-sin-ti.jpg',
  },
  {
    slug: 'la-mente-que-crea-fortuna',
    titulo: 'La mente que crea fortuna',
    estado: 'dado',
    resumen:
      'Ocho etapas para preparar el terreno interior: disposición, identidad de constructor, atención como capital, valor antes que billete y ritmo de cosecha.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-23',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/la-mente-que-crea-fortuna/01-portada-fortuna.jpg',
  },
  {
    slug: 'la-multiplicacion-silenciosa',
    titulo: 'La multiplicación silenciosa',
    estado: 'dado',
    resumen:
      'Ocho etapas para multiplicar sin espectáculo: semilla, carácter, hábito, tapar fugas, reinversión consciente y tablero de mayordomía.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-23',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/la-multiplicacion-silenciosa/01-portada-multiplica.jpg',
  },
  {
    slug: 'el-codigo-de-la-realidad',
    titulo: 'El código de la realidad',
    estado: 'dado',
    resumen:
      'Ocho etapas para leer y reescribir el código mental: creencias-instrucción, filtro de atención, narrativa dominante y experimentos con hechos.',
    etapas: 8,
    modalidad: 'Zoom y presencial',
    fechaDado: '2026-11-23',
    cuotaImparticion: 'Cuota de impartición en vivo (Zoom o presencial), a convenir con el docente.',
    portada: '/cursos-assets/el-codigo-de-la-realidad/01-portada-codigo.jpg',
  },
  {
    slug: 'proximo-itinerario',
    titulo: 'Próximo itinerario',
    estado: 'programado',
    resumen:
      'El siguiente curso lo construiremos con lo que ustedes pidan en «¿Qué curso necesitas?». Misma pedagogía: de menor a mayor, claro y persuasivo.',
    etapas: 0,
    modalidad: 'Zoom y presencial',
    fechaProgramada: 'Por anunciar · abierto a solicitudes',
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
