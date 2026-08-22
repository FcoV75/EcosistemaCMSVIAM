import leccionesCuerpo from '../../content/cursos/el-cuerpo-escucha/index.html?raw'
import diapositivasCuerpo from '../../content/cursos/el-cuerpo-escucha/diapositivas.html?raw'
import slidesCuerpo from '../../content/cursos/el-cuerpo-escucha/slides.js?raw'
import guiaCuerpo from '../../content/cursos/el-cuerpo-escucha/guia-docente.md?raw'
import leccionesLeete from '../../content/cursos/leete-y-lee/index.html?raw'
import diapositivasLeete from '../../content/cursos/leete-y-lee/diapositivas.html?raw'
import slidesLeete from '../../content/cursos/leete-y-lee/slides.js?raw'
import guiaLeete from '../../content/cursos/leete-y-lee/guia-docente.md?raw'

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
}
