import leccionesCuerpo from '../../content/cursos/el-cuerpo-escucha/index.html?raw'
import diapositivasCuerpo from '../../content/cursos/el-cuerpo-escucha/diapositivas.html?raw'
import slidesCuerpo from '../../content/cursos/el-cuerpo-escucha/slides.js?raw'
import guiaCuerpo from '../../content/cursos/el-cuerpo-escucha/guia-docente.md?raw'
import leccionesLeete from '../../content/cursos/leete-y-lee/index.html?raw'
import diapositivasLeete from '../../content/cursos/leete-y-lee/diapositivas.html?raw'
import slidesLeete from '../../content/cursos/leete-y-lee/slides.js?raw'
import guiaLeete from '../../content/cursos/leete-y-lee/guia-docente.md?raw'
import leccionesPausa from '../../content/cursos/la-pausa-que-decide/index.html?raw'
import diapositivasPausa from '../../content/cursos/la-pausa-que-decide/diapositivas.html?raw'
import slidesPausa from '../../content/cursos/la-pausa-que-decide/slides.js?raw'
import guiaPausa from '../../content/cursos/la-pausa-que-decide/guia-docente.md?raw'
import leccionesPalabra from '../../content/cursos/la-palabra-que-no-obliga/index.html?raw'
import diapositivasPalabra from '../../content/cursos/la-palabra-que-no-obliga/diapositivas.html?raw'
import slidesPalabra from '../../content/cursos/la-palabra-que-no-obliga/slides.js?raw'
import guiaPalabra from '../../content/cursos/la-palabra-que-no-obliga/guia-docente.md?raw'

export const CURSOS_BUNDLED: Record<
  string,
  { lecciones: string; diapositivas: string; slides: string; guia: string; zipPublicUrl: string }
> = {
  'el-cuerpo-escucha': {
    lecciones: leccionesCuerpo,
    diapositivas: diapositivasCuerpo,
    slides: slidesCuerpo,
    guia: guiaCuerpo,
    zipPublicUrl: '/cursos-assets/el-cuerpo-escucha/paquete-recuperacion-k7m2q9w4.zip',
  },
  'leete-y-lee': {
    lecciones: leccionesLeete,
    diapositivas: diapositivasLeete,
    slides: slidesLeete,
    guia: guiaLeete,
    zipPublicUrl: '/cursos-assets/leete-y-lee/paquete-recuperacion-n4p8r2x6.zip',
  },
  'la-pausa-que-decide': {
    lecciones: leccionesPausa,
    diapositivas: diapositivasPausa,
    slides: slidesPausa,
    guia: guiaPausa,
    zipPublicUrl: '/cursos-assets/la-pausa-que-decide/paquete-recuperacion-t8w3n6q1.zip',
  },
  'la-palabra-que-no-obliga': {
    lecciones: leccionesPalabra,
    diapositivas: diapositivasPalabra,
    slides: slidesPalabra,
    guia: guiaPalabra,
    zipPublicUrl: '/cursos-assets/la-palabra-que-no-obliga/paquete-recuperacion-p4k7m2s9.zip',
  },
}
