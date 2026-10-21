import { createFileRoute, Link } from '@tanstack/react-router'
import { ContacNeedLogo } from '../components/ContacNeedLogo'

export const Route = createFileRoute('/terminos')({
  component: TerminosPage,
  head: () => ({
    meta: [
      { title: 'Condiciones de Servicio | ContacNeed' },
      {
        name: 'description',
        content:
          'Condiciones de servicio de ContacNeed: reglas de uso de la red social de oficios, profesiones y especialidades.',
      },
    ],
  }),
})

function TerminosPage() {
  return (
    <div className="cn-metallic-bg min-h-screen px-4 py-10">
      <article className="cn-glass mx-auto max-w-3xl rounded-2xl border border-amber-500/20 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <ContacNeedLogo className="mb-3 h-14 w-auto max-w-[180px]" />
          <h1 className="text-2xl font-black text-white">Condiciones de Servicio</h1>
          <p className="mt-1 text-sm text-purple-200/70">Última actualización: 21 de octubre de 2026</p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-purple-100/90">
          <p>
            Al usar ContacNeed en{' '}
            <a href="https://contacneed.com" className="text-amber-300 hover:underline">
              contacneed.com
            </a>{' '}
            aceptas estas condiciones. Si no estás de acuerdo, no uses la plataforma.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">1. El servicio</h2>
            <p>
              ContacNeed es una red social para conectar personas vinculadas a oficios,
              profesiones, especialidades y perfiles observadores. Ofrecemos funciones gratuitas y,
              en su caso, planes o beneficios de pago (p. ej. ContacNeed Pro).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">2. Cuenta</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Debes tener al menos 18 años y proporcionar información veraz.</li>
              <li>Eres responsable de tu contraseña y de la actividad en tu cuenta.</li>
              <li>
                Puedes registrarte con correo o con Google. Al usar Google, también aplican las
                condiciones de Google.
              </li>
              <li>Podemos suspender o eliminar cuentas por abuso, fraude o incumplimiento.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">3. Conducta</h2>
            <p>No está permitido:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Publicar contenido ilegal, engañoso, difamatorio, discriminatorio o pornográfico.</li>
              <li>Suplantar a otra persona o fingir credenciales profesionales falsas.</li>
              <li>Acosar, spam, malware o intentar vulnerar la seguridad del servicio.</li>
              <li>Usar ContacNeed para actividades ilícitas o para dañar a terceros.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">4. Contenido</h2>
            <p>
              Tú conservas los derechos sobre lo que publicas. Nos otorgas una licencia no
              exclusiva para alojarlo, mostrarlo y operar la plataforma. No garantizamos que el
              contenido de otros usuarios sea exacto; las contrataciones o tratos entre miembros
              son bajo tu propia responsabilidad.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">5. Pagos</h2>
            <p>
              Si adquieres un plan de pago, se aplican los precios y condiciones mostrados en el
              momento de la compra (procesados por proveedores de pago como Stripe u otros
              indicados en la app). Las renovaciones y cancelaciones siguen las reglas del
              proveedor y de ContacNeed vigentes al contratar.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">6. Disponibilidad</h2>
            <p>
              Buscamos mantener ContacNeed disponible, pero el servicio se ofrece «tal cual», sin
              garantía de disponibilidad ininterrumpida. Podemos modificar o discontinuar
              funciones con aviso razonable cuando sea posible.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">7. Limitación de responsabilidad</h2>
            <p>
              En la medida permitida por la ley, ContacNeed no responde por daños indirectos,
              lucro cesante o disputas entre usuarios derivadas del uso de la plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">8. Privacidad</h2>
            <p>
              El tratamiento de datos se describe en nuestra{' '}
              <Link to="/privacidad" className="text-amber-300 hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">9. Cambios</h2>
            <p>
              Podemos actualizar estas condiciones. La fecha de actualización indica la versión
              vigente. Seguir usando ContacNeed después de un cambio implica aceptación de la
              nueva versión.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-amber-300">10. Contacto</h2>
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
          <Link to="/privacidad" className="text-amber-300 hover:underline">
            Política de privacidad
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
