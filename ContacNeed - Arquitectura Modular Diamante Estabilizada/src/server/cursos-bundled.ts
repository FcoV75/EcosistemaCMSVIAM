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
import leccionesCmsPlus from '../../content/cursos/circulo-cms-plus-membresias/index.html?raw'
import diapositivasCmsPlus from '../../content/cursos/circulo-cms-plus-membresias/diapositivas.html?raw'
import slidesCmsPlus from '../../content/cursos/circulo-cms-plus-membresias/slides.js?raw'
import guiaCmsPlus from '../../content/cursos/circulo-cms-plus-membresias/guia-docente.md?raw'
import leccionesEnergia from '../../content/cursos/no-es-dinero-es-energia/index.html?raw'
import diapositivasEnergia from '../../content/cursos/no-es-dinero-es-energia/diapositivas.html?raw'
import slidesEnergia from '../../content/cursos/no-es-dinero-es-energia/slides.js?raw'
import guiaEnergia from '../../content/cursos/no-es-dinero-es-energia/guia-docente.md?raw'
import leccionesSalto from '../../content/cursos/el-salto-que-despierta/index.html?raw'
import diapositivasSalto from '../../content/cursos/el-salto-que-despierta/diapositivas.html?raw'
import slidesSalto from '../../content/cursos/el-salto-que-despierta/slides.js?raw'
import guiaSalto from '../../content/cursos/el-salto-que-despierta/guia-docente.md?raw'
import leccionesEndurece from '../../content/cursos/la-mente-que-endurece/index.html?raw'
import diapositivasEndurece from '../../content/cursos/la-mente-que-endurece/diapositivas.html?raw'
import slidesEndurece from '../../content/cursos/la-mente-que-endurece/slides.js?raw'
import guiaEndurece from '../../content/cursos/la-mente-que-endurece/guia-docente.md?raw'
import leccionesDecide from '../../content/cursos/lo-que-decide-sin-ti/index.html?raw'
import diapositivasDecide from '../../content/cursos/lo-que-decide-sin-ti/diapositivas.html?raw'
import slidesDecide from '../../content/cursos/lo-que-decide-sin-ti/slides.js?raw'
import guiaDecide from '../../content/cursos/lo-que-decide-sin-ti/guia-docente.md?raw'
import leccionesFortuna from '../../content/cursos/la-mente-que-crea-fortuna/index.html?raw'
import diapositivasFortuna from '../../content/cursos/la-mente-que-crea-fortuna/diapositivas.html?raw'
import slidesFortuna from '../../content/cursos/la-mente-que-crea-fortuna/slides.js?raw'
import guiaFortuna from '../../content/cursos/la-mente-que-crea-fortuna/guia-docente.md?raw'
import leccionesMultiplica from '../../content/cursos/la-multiplicacion-silenciosa/index.html?raw'
import diapositivasMultiplica from '../../content/cursos/la-multiplicacion-silenciosa/diapositivas.html?raw'
import slidesMultiplica from '../../content/cursos/la-multiplicacion-silenciosa/slides.js?raw'
import guiaMultiplica from '../../content/cursos/la-multiplicacion-silenciosa/guia-docente.md?raw'
import leccionesCodigo from '../../content/cursos/el-codigo-de-la-realidad/index.html?raw'
import diapositivasCodigo from '../../content/cursos/el-codigo-de-la-realidad/diapositivas.html?raw'
import slidesCodigo from '../../content/cursos/el-codigo-de-la-realidad/slides.js?raw'
import guiaCodigo from '../../content/cursos/el-codigo-de-la-realidad/guia-docente.md?raw'

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
  'circulo-cms-plus-membresias': {
    lecciones: leccionesCmsPlus,
    diapositivas: diapositivasCmsPlus,
    slides: slidesCmsPlus,
    guia: guiaCmsPlus,
    zipPublicUrl: '/cursos-assets/circulo-cms-plus-membresias/paquete-recuperacion-cmsplus-z3m9k2w7.zip',
  },
  'no-es-dinero-es-energia': {
    lecciones: leccionesEnergia,
    diapositivas: diapositivasEnergia,
    slides: slidesEnergia,
    guia: guiaEnergia,
    zipPublicUrl: '/cursos-assets/no-es-dinero-es-energia/paquete-recuperacion-energia-m8q2k5n1.zip',
  },
  'el-salto-que-despierta': {
    lecciones: leccionesSalto,
    diapositivas: diapositivasSalto,
    slides: slidesSalto,
    guia: guiaSalto,
    zipPublicUrl: '/cursos-assets/el-salto-que-despierta/paquete-recuperacion-salto-r4t7w2p9.zip',
  },
  'la-mente-que-endurece': {
    lecciones: leccionesEndurece,
    diapositivas: diapositivasEndurece,
    slides: slidesEndurece,
    guia: guiaEndurece,
    zipPublicUrl: '/cursos-assets/la-mente-que-endurece/paquete-recuperacion-endurece-h3n6v8c2.zip',
  },
  'lo-que-decide-sin-ti': {
    lecciones: leccionesDecide,
    diapositivas: diapositivasDecide,
    slides: slidesDecide,
    guia: guiaDecide,
    zipPublicUrl: '/cursos-assets/lo-que-decide-sin-ti/paquete-recuperacion-decide-j5k9m1x4.zip',
  },
  'la-mente-que-crea-fortuna': {
    lecciones: leccionesFortuna,
    diapositivas: diapositivasFortuna,
    slides: slidesFortuna,
    guia: guiaFortuna,
    zipPublicUrl: '/cursos-assets/la-mente-que-crea-fortuna/paquete-recuperacion-fortuna-k4n8p2w6.zip',
  },
  'la-multiplicacion-silenciosa': {
    lecciones: leccionesMultiplica,
    diapositivas: diapositivasMultiplica,
    slides: slidesMultiplica,
    guia: guiaMultiplica,
    zipPublicUrl: '/cursos-assets/la-multiplicacion-silenciosa/paquete-recuperacion-multiplica-t7v3m9q2.zip',
  },
  'el-codigo-de-la-realidad': {
    lecciones: leccionesCodigo,
    diapositivas: diapositivasCodigo,
    slides: slidesCodigo,
    guia: guiaCodigo,
    zipPublicUrl: '/cursos-assets/el-codigo-de-la-realidad/paquete-recuperacion-codigo-r5w8n3k7.zip',
  },
}
