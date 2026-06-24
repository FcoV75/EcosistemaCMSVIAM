import { useState } from 'react'
import { MEXICO_STATES } from '../lib/mexico-states'
import { signUpFn } from '../server/auth.functions'

const MEMBER_TYPES = ['Observador', 'Oficio', 'Profesion', 'Especialidad'] as const

type RegistroFormProps = {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
  compact?: boolean
}

export function RegistroForm({ onSuccess, onSwitchToLogin, compact }: RegistroFormProps) {
  const [tipo, setTipo] = useState<(typeof MEMBER_TYPES)[number]>('Oficio')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const needsCedula = tipo === 'Profesion' || tipo === 'Especialidad'
  const needsProfession = tipo !== 'Observador'

  return (
    <form
      className={`space-y-4 ${compact ? 'text-sm' : ''}`}
      onSubmit={async (event) => {
        event.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)
        const form = new FormData(event.currentTarget)

        try {
          const result = await signUpFn({
            data: {
              email: String(form.get('email')),
              password: String(form.get('password')),
              nombre: String(form.get('nombre')),
              tipo_miembro: tipo,
              direccion: String(form.get('direccion') ?? ''),
              cp: String(form.get('cp') ?? ''),
              celular: String(form.get('celular') ?? ''),
              estado: String(form.get('estado') ?? ''),
              municipio: String(form.get('municipio') ?? ''),
              comunidad: String(form.get('comunidad') ?? ''),
              sexo: String(form.get('sexo') ?? ''),
              fecha_nacimiento: String(form.get('fecha_nacimiento') ?? ''),
              habilidad_empirica: String(form.get('habilidad_empirica') ?? ''),
              descripcion_profesion: String(form.get('descripcion_profesion') ?? ''),
              cedula: String(form.get('cedula') ?? ''),
            },
          })

          if (result.needsEmailConfirmation) {
            setSuccess(result.message)
            return
          }

          onSuccess?.()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo completar el registro')
        } finally {
          setLoading(false)
        }
      }}
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-amber-300">Tipo de miembro</legend>
        {MEMBER_TYPES.map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
              tipo === option
                ? 'border-amber-400 bg-amber-500/15 text-amber-100'
                : 'border-purple-500/20 text-purple-200/70'
            }`}
          >
            <input
              type="radio"
              name="tipo_miembro"
              value={option}
              checked={tipo === option}
              onChange={() => setTipo(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" name="nombre" required />
        <Field label="Correo electrónico" name="email" type="email" required />
        <Field label="Contraseña" name="password" type="password" required />
        <Field label="Celular" name="celular" type="tel" />
        <Field label="Dirección" name="direccion" className="sm:col-span-2" />
        <Field label="Código postal" name="cp" />
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-purple-200/80">Estado</span>
          <select
            name="estado"
            className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
          >
            <option value="">Selecciona...</option>
            {MEXICO_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <Field label="Municipio" name="municipio" />
        <Field label="Comunidad (si aplica)" name="comunidad" />
        <Field label="Sexo" name="sexo" />
        <Field label="Fecha de nacimiento" name="fecha_nacimiento" type="date" />
      </div>

      {needsProfession && (
        <div className="space-y-4 border-t border-purple-500/15 pt-4">
          <Field
            label={
              tipo === 'Oficio'
                ? 'Nombre de tu oficio o habilidad'
                : 'Profesión, licenciatura o especialidad'
            }
            name="habilidad_empirica"
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block text-purple-200/80">Descripción de tu oficio o servicio</span>
            <textarea
              name="descripcion_profesion"
              rows={3}
              className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
              placeholder="Describe brevemente qué ofreces..."
            />
          </label>
        </div>
      )}

      {needsCedula && <Field label="Cédula profesional" name="cedula" required />}

      {success && (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {success}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="cn-btn-metallic w-full rounded-xl py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
      >
        {loading ? 'Registrando...' : 'Crear mi cuenta'}
      </button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-purple-200/70">
          ¿Ya tienes cuenta?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-amber-300 hover:text-amber-200"
          >
            Inicia sesión
          </button>
        </p>
      )}
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  className = '',
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-purple-200/80">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
      />
    </label>
  )
}
