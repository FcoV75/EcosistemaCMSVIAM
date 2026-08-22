import lecciones from '../../content/cursos/el-cuerpo-escucha/index.html?raw'
import diapositivas from '../../content/cursos/el-cuerpo-escucha/diapositivas.html?raw'
import slides from '../../content/cursos/el-cuerpo-escucha/slides.js?raw'
import guia from '../../content/cursos/el-cuerpo-escucha/guia-docente.md?raw'

export const CURSOS_BUNDLED: Record<
  string,
  { lecciones: string; diapositivas: string; slides: string; guia: string; zipPublicUrl: string }
> = {
  'el-cuerpo-escucha': {
    lecciones,
    diapositivas,
    slides,
    guia,
    zipPublicUrl: '/cursos-assets/el-cuerpo-escucha/paquete-recuperacion-k7m2q9w4.zip',
  },
}
