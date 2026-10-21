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
          'Política de privacidad de ContacNeed: cómo tratamos tus datos al usar la red social de oficios y al iniciar sesión con Google.',
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
          <p className="mt-1 text-sm text-purple-200/70">Última actualización: 21 de octubre de 2026</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-purple-100/90">
          <p>
            ContacNeed («nosotros») opera la plataforma en{' '}
            <a href="https://contacneed.com" className="text-amber-300 hover:underline">
              contacneed.com
            </a>
            , una red social orientada a oficios, profesiones y especialidades. Esta política
            explica qué datos recopilamos y cómo los usamos.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">1. Datos que recopilamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Datos de cuenta: nombre, correo, contraseña (si te registras con email) y perfil.</li>
              <li>
                Si usas «Entrar / Registrarme con Google»: nombre, correo, foto de perfil y
                identificadores que Google nos comparte con tu consentimiento.
              </li>
              <li>
                Datos de oficio o profesión que tú indiques (tipo de miembro, descripción,
                cédula si aplica, ubicación aproximada).
              </li>
              <li>Contenido que publiques: avisos, mensajes, comentarios y archivos que subas.</li>
              <li>Datos técnicos básicos: IP, tipo de dispositivo y registros de seguridad.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">2. Para qué los usamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Crear y mantener tu cuenta, autenticarte y mostrarte tu perfil.</li>
              <li>Operar la red social (publicaciones, mensajes, avisos y funciones Pro).</li>
              <li>Enviar correos de confirmación, recuperación de contraseña y avisos del servicio.</li>
              <li>Prevenir abuso, fraude y accesos no autorizados.</li>
              <li>Mejorar la plataforma y cumplir obligaciones legales aplicables.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">3. Proveedores</h2>
            <p>
              Usamos proveedores que nos ayudan a operar ContacNeed, entre ellos servicios de
              autenticación (p. ej. Supabase y Google, si eliges ese acceso), hospedaje, correo y
              pagos. Solo reciben lo necesario para prestar su servicio bajo sus propias políticas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">4. Conservación y seguridad</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa o sea necesario para el
              servicio, seguridad o requisitos legales. Aplicamos medidas razonables de protección;
              ningún sistema es 100&nbsp;% seguro.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">5. Tus derechos</h2>
            <p>
              Puedes solicitar acceso, corrección o eliminación de tus datos de cuenta, y cerrar tu
              cuenta cuando lo desees, sujeto a obligaciones legales o de seguridad. Escríbenos a{' '}
              <a href="mailto:noreply@contacneed.com" className="text-amber-300 hover:underline">
                noreply@contacneed.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">6. Menores</h2>
            <p>
              ContacNeed no está dirigido a menores de 18 años. Si detectamos una cuenta de un
              menor, podremos suspenderla o eliminarla.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">7. Cambios</h2>
            <p>
              Podemos actualizar esta política. La fecha de «última actualización» indica la
              versión vigente. El uso continuado de ContacNeed tras un cambio implica que tomaste
              nota de la nueva versión.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">8. Contacto</h2>
            <p>
              ContacNeed ·{' '}
              <a href="https://contacneed.com" className="text-amber-300 hover:underline">
                contacneed.com
              </a>{' '}
              ·{' '}
              <a href="mailto:noreply@contacneed.com" className="text-amber-300 hover:underline">
                noreply@contacneed.com
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
