import { createFileRoute, Link } from '@tanstack/react-router'
import { ContacNeedLogo } from '../components/ContacNeedLogo'

export const Route = createFileRoute('/privacidad')({
  component: PrivacidadPage,
  head: () => ({
    meta: [
      { title: 'Política de Privacidad | ContacNeed' },
      {
        name: 'description',
        content:
          'Política de privacidad de ContacNeed: datos que recopilamos (incluido Google Sign-In), uso, retención, derechos y contacto.',
      },
    ],
  }),
})

function PrivacidadPage() {
  return (
    <div className="cn-metallic-bg min-h-screen px-4 py-10">
      <article className="cn-glass mx-auto max-w-3xl rounded-2xl border border-amber-500/20 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <ContacNeedLogo className="mb-3 h-14 w-auto max-w-[180px]" />
          <h1 className="text-2xl font-black text-white">Política de Privacidad</h1>
          <p className="mt-1 text-sm text-purple-200/70">
            ContacNeed · https://contacneed.com
          </p>
          <p className="mt-1 text-sm text-purple-200/70">Última actualización: 21 de octubre de 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-purple-100/90">
          <p>
            Esta Política de Privacidad describe cómo ContacNeed («nosotros», «la plataforma»)
            recopila, usa, almacena, comparte y protege la información personal de las personas que
            visitan o usan nuestro sitio y aplicación en{' '}
            <a href="https://contacneed.com" className="text-amber-300 hover:underline">
              https://contacneed.com
            </a>
            . ContacNeed es una red social orientada a oficios, profesiones, especialidades y
            perfiles observadores, en la que los miembros pueden crear cuenta, completar su perfil,
            publicar contenido, enviar mensajes y, en su caso, contratar planes de pago.
          </p>
          <p>
            Al crear una cuenta, iniciar sesión (incluido «Entrar / Registrarme con Google») o usar
            ContacNeed, aceptas las prácticas descritas aquí. Si no estás de acuerdo, no uses el
            servicio. El tratamiento de datos se rige también por nuestras{' '}
            <Link to="/terminos" className="text-amber-300 hover:underline">
              Condiciones de Servicio
            </Link>
            .
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos personales asociados a ContacNeed es el
              operador de la plataforma ContacNeed, con sitio web{' '}
              <strong className="text-white">https://contacneed.com</strong>.
            </p>
            <p>
              Contacto de privacidad y solicitudes de derechos:{' '}
              <a href="mailto:noreply@contacneed.com" className="text-amber-300 hover:underline">
                noreply@contacneed.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">2. Datos personales que recopilamos</h2>
            <p>Podemos recopilar las siguientes categorías de información:</p>

            <h3 className="font-semibold text-white">2.1 Datos de registro y cuenta</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nombre completo o nombre mostrado en el perfil.</li>
              <li>Correo electrónico.</li>
              <li>Contraseña (si te registras con correo; se almacena de forma cifrada/hash).</li>
              <li>Número celular, dirección, código postal, estado, municipio y comunidad (si los indicas).</li>
              <li>Sexo y fecha de nacimiento (si los indicas).</li>
              <li>
                Tipo de miembro (Observador, Oficio, Profesión o Especialidad), nombre del oficio o
                habilidad, descripción del servicio, cédula profesional (si aplica) e indicación de
                si eres estudiante con cédula pendiente.
              </li>
              <li>Foto o avatar de perfil.</li>
              <li>Código de referido y datos relacionados de invitaciones, si usas ese programa.</li>
            </ul>

            <h3 className="font-semibold text-white">2.2 Datos cuando inicias sesión con Google</h3>
            <p>
              Si eliges «Entrar con Google» o «Registrarme con Google», Google nos comparte, con tu
              autorización en la pantalla de consentimiento de Google, información de tu cuenta
              Google. En la práctica, ContacNeed solicita y puede recibir:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Tu dirección de correo electrónico de Google.</li>
              <li>Tu nombre de perfil de Google.</li>
              <li>La URL de tu foto de perfil de Google (avatar).</li>
              <li>
                Identificadores técnicos necesarios para autenticarte de forma segura (por ejemplo,
                tokens o códigos de autorización OAuth gestionados a través de nuestro proveedor de
                autenticación).
              </li>
            </ul>
            <p>
              <strong className="text-white">No</strong> solicitamos acceso a tu Gmail, contactos,
              Drive, Calendar ni otros datos de Google más allá del perfil básico necesario para
              crear o abrir tu sesión en ContacNeed. El uso de la información recibida de Google se
              limita a autenticarte, crear o vincular tu cuenta ContacNeed, mostrar tu nombre y
              avatar en la plataforma, y comunicarnos contigo sobre el servicio.
            </p>

            <h3 className="font-semibold text-white">2.3 Contenido que generas en la plataforma</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Publicaciones, comentarios, reacciones, reportes y archivos multimedia que subas.</li>
              <li>Mensajes privados entre miembros.</li>
              <li>Avisos, notificaciones y actividad de interacción social.</li>
              <li>Información de cursos, escuela o privilegios que solicites o te sean otorgados.</li>
            </ul>

            <h3 className="font-semibold text-white">2.4 Datos de pago</h3>
            <p>
              Si contratas un plan de pago (por ejemplo ContacNeed Pro u otros productos), el cobro
              lo procesan proveedores de pago (como Stripe u otros indicados en el flujo de compra).
              ContacNeed puede recibir confirmaciones de pago, identificadores de sesión o
              suscripción y el estado del plan. Por regla general{' '}
              <strong className="text-white">no almacenamos</strong> el número completo de tu
              tarjeta; esos datos quedan en el procesador de pagos.
            </p>

            <h3 className="font-semibold text-white">2.5 Datos técnicos y de uso</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Dirección IP, tipo de navegador o dispositivo, sistema operativo y fechas de acceso.</li>
              <li>Páginas visitadas dentro de ContacNeed y eventos básicos de uso del servicio.</li>
              <li>
                Cookies o almacenamiento local necesarios para mantener tu sesión, preferencias y
                seguridad (por ejemplo, sesión autenticada).
              </li>
              <li>Registros de errores y seguridad para diagnosticar fallos y prevenir abuso.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">3. Cómo usamos tus datos</h2>
            <p>Utilizamos la información personal para:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Crear, verificar, mantener y asegurar tu cuenta.</li>
              <li>Permitir el inicio de sesión con correo o con Google.</li>
              <li>Mostrar tu perfil, oficio/profesión y contenido a otros miembros según la configuración del servicio.</li>
              <li>Operar funciones sociales: feed, comentarios, mensajes, avisos, búsqueda de personas y referidos.</li>
              <li>
                Enviar correos transaccionales: confirmación de cuenta, recuperación de contraseña,
                avisos de privilegios o notificaciones del servicio.
              </li>
              <li>Procesar suscripciones o pagos y habilitar beneficios asociados.</li>
              <li>Prevenir fraude, spam, abusos, accesos no autorizados e infracciones a las Condiciones.</li>
              <li>Cumplir obligaciones legales y responder a requerimientos válidos de autoridad.</li>
              <li>Mejorar la estabilidad, el rendimiento y la experiencia de ContacNeed.</li>
            </ul>
            <p>
              <strong className="text-white">No vendemos</strong> tu información personal. No usamos
              los datos obtenidos de Google Sign-In para publicidad dirigida de terceros ni para
              entrenar modelos de inteligencia artificial de terceros con tu información de Google.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">
              4. Uso limitado de datos de Google (Google API Services User Data Policy)
            </h2>
            <p>
              El uso que ContacNeed hace de la información recibida de las APIs de Google se
              adhiere a la{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-amber-300 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , incluidas las requisitos de uso limitado (Limited Use). En concreto:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Solo usamos los datos de Google para proporcionar o mejorar funciones visibles para
                el usuario relacionadas con el inicio de sesión y el perfil en ContacNeed.
              </li>
              <li>
                No transferimos esos datos a terceros salvo: (a) para operar ContacNeed con
                proveedores necesarios (p. ej. autenticación y hospedaje), (b) por requerimiento
                legal, o (c) con tu consentimiento explícito.
              </li>
              <li>
                No usamos esos datos para publicidad, ni permitimos que humanos los lean salvo
                excepciones permitidas por la política de Google (p. ej. seguridad, cumplimiento o
                soporte con tu consentimiento).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">5. Con quién compartimos información</h2>
            <p>Podemos compartir datos únicamente en estos casos:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white">Proveedores de infraestructura:</strong> hospedaje,
                base de datos y autenticación (por ejemplo servicios tipo Supabase/Netlify), envío
                de correo (por ejemplo Resend) y procesamiento de pagos (por ejemplo Stripe).
              </li>
              <li>
                <strong className="text-white">Google:</strong> cuando usas Google Sign-In, el flujo
                de autenticación ocurre con Google y nuestro proveedor de auth; Google trata datos
                según su propia política de privacidad.
              </li>
              <li>
                <strong className="text-white">Otros miembros:</strong> la información de perfil y
                publicaciones que marques como visibles forma parte de la red social.
              </li>
              <li>
                <strong className="text-white">Autoridades:</strong> cuando la ley lo exija o para
                proteger derechos, seguridad e integridad del servicio.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">6. Conservación de datos</h2>
            <p>
              Conservamos tu información mientras tu cuenta esté activa y el tiempo adicional
              necesario para operar el servicio, resolver disputas, hacer cumplir las Condiciones,
              prevenir fraude y cumplir obligaciones legales o contables. Si solicitas la
              eliminación de tu cuenta, borraremos o anonimizaremos los datos personales asociados
              en un plazo razonable, salvo que debamos conservarlos por ley, seguridad o
              reclamaciones pendientes. Los respaldos técnicos pueden tardar un tiempo adicional en
              depurarse.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">7. Seguridad</h2>
            <p>
              Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito mediante
              HTTPS, controles de acceso, hashing de contraseñas y monitoreo básico de seguridad).
              Ningún método de transmisión o almacenamiento es completamente seguro; te pedimos
              usar contraseñas fuertes y no compartir tu acceso.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">8. Tus derechos</h2>
            <p>Según la legislación aplicable, puedes solicitar:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Acceso a los datos personales que tenemos sobre ti.</li>
              <li>Corrección de datos inexactos o incompletos.</li>
              <li>Eliminación de tu cuenta o de ciertos datos.</li>
              <li>Oposición o limitación de ciertos tratamientos, cuando proceda.</li>
              <li>Revocar el acceso de ContacNeed a tu cuenta Google desde la configuración de Google.</li>
            </ul>
            <p>
              Para ejercer estos derechos, escribe a{' '}
              <a href="mailto:noreply@contacneed.com" className="text-amber-300 hover:underline">
                noreply@contacneed.com
              </a>{' '}
              indicando el correo de tu cuenta ContacNeed. También puedes actualizar gran parte de
              tu perfil desde la propia plataforma. Podemos pedirte verificar tu identidad antes de
              atender la solicitud.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">9. Cookies y tecnologías similares</h2>
            <p>
              Usamos cookies y almacenamiento local/session principalmente para autenticación,
              seguridad y preferencias de interfaz. No dependemos de redes publicitarias de
              terceros para el funcionamiento básico de ContacNeed. Puedes controlar cookies desde
              tu navegador; bloquear las esenciales puede impedir iniciar sesión.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">10. Menores de edad</h2>
            <p>
              ContacNeed está dirigido a personas de 18 años o más. No recopilamos a sabiendas
              datos de menores. Si eres padre, madre o tutor y crees que un menor nos proporcionó
              datos, contáctanos para eliminarlos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">11. Transferencias internacionales</h2>
            <p>
              Nuestros proveedores pueden procesar datos en servidores ubicados fuera de tu país
              (por ejemplo Estados Unidos u otras regiones). Al usar ContacNeed aceptas que tus
              datos puedan transferirse y tratarse en esos lugares con las salvaguardas que ofrezca
              cada proveedor.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">12. Enlaces a terceros</h2>
            <p>
              ContacNeed puede contener enlaces a sitios de terceros. No controlamos sus prácticas
              de privacidad. Te recomendamos leer las políticas de esos sitios antes de compartir
              información.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">13. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad para reflejar cambios del servicio o
              de la ley. Publicaremos la versión vigente en{' '}
              <a href="https://contacneed.com/privacidad" className="text-amber-300 hover:underline">
                https://contacneed.com/privacidad
              </a>{' '}
              con la fecha de «última actualización». El uso continuado de ContacNeed después de un
              cambio implica que tomaste conocimiento de la nueva versión.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">14. Contacto</h2>
            <p>
              ContacNeed
              <br />
              Sitio:{' '}
              <a href="https://contacneed.com" className="text-amber-300 hover:underline">
                https://contacneed.com
              </a>
              <br />
              Privacidad y derechos:{' '}
              <a href="mailto:noreply@contacneed.com" className="text-amber-300 hover:underline">
                noreply@contacneed.com
              </a>
              <br />
              Política de privacidad:{' '}
              <a href="https://contacneed.com/privacidad" className="text-amber-300 hover:underline">
                https://contacneed.com/privacidad
              </a>
              <br />
              Condiciones de servicio:{' '}
              <a href="https://contacneed.com/terminos" className="text-amber-300 hover:underline">
                https://contacneed.com/terminos
              </a>
            </p>
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-purple-300/60">
          <Link to="/terminos" className="text-amber-300 hover:underline">
            Condiciones de servicio
          </Link>
          {' · '}
          <Link to="/" className="hover:text-white">
            Volver a ContacNeed
          </Link>
        </p>
      </article>
    </div>
  )
}
