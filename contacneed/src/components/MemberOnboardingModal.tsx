import { useMemo, useState } from 'react'
import { MEXICO_STATES } from '../lib/mexico-states'
import { MEMBER_TYPES, validateOnboardingInput } from '../lib/signup-validation'
import {
  completeMemberOnboardingFn,
  postponeMemberOnboardingFn,
} from '../server/auth.functions'

type MemberOnboardingModalProps = {
  open: boolean
  forced?: boolean
  pospuestos?: number
  onCompleted: () => void
  onPostponed: () => void
}

export function MemberOnboardingModal({
  open,
  forced = true,
  pospuestos = 0,
  onCompleted,
  onPostponed,
}: MemberOnboardingModalProps) {
  const [tipo, setTipo] = useState<(typeof MEMBER_TYPES)[number]>('Oficio')
  const [esEstudiante, setEsEstudiante] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2>(1)

  const needsProfession = tipo !== 'Observador'
  const needsCedula = (tipo === 'Profesion' || tipo === 'Especialidad') && !esEstudiante
  const canPostpone = pospuestos < 2

  const hint = useMemo(() => {
    if (tipo === 'Observador') return 'Explora la red sin ofrecer servicios todavía.'
    if (tipo === 'Oficio') return 'Oficios, habilidades prácticas o estudiantes/pasantes sin cédula.'
    if (tipo === 'Profesion') return 'Profesionales con cédula (médicos, abogados, ingenieros…).'
    return 'Especialistas con cédula (posgrado o especialidad clínica).'
  }, [tipo])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="cn-glass max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-500/30 p-5 shadow-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
          Un paso más
        </p>
        <h2 className="mt-1 text-xl font-black text-white">¿Cómo quieres participar?</h2>
        <p className="mt-2 text-sm text-purple-200/75">
          Ya estás dentro. Cuéntanos si eres observador o a qué te dedicas — es lo más importante de ContacNeed.
        </p>

        {step === 1 ? (
          <div className="mt-5 space-y-3">
            <fieldset className="grid gap-2 sm:grid-cols-2">
              {MEMBER_TYPES.map((option) => (
                <label
                  key={option}
                  className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${
                    tipo === option
                      ? 'border-amber-400 bg-amber-500/15 text-amber-100'
                      : 'border-purple-500/20 text-purple-200/70'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_miembro_onboarding"
                    value={option}
                    checked={tipo === option}
                    onChange={() => {
                      setTipo(option)
                      if (option === 'Observador') setEsEstudiante(false)
                    }}
                    className="sr-only"
                  />
                  <span className="font-semibold">{option}</span>
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-purple-200/60">{hint}</p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="cn-btn-metallic mt-2 w-full rounded-xl py-3 text-sm font-bold text-slate-950"
            >
              Continuar
            </button>
          </div>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              setLoading(true)
              setError(null)
              const form = new FormData(event.currentTarget)
              try {
                const draft = {
                  tipo_miembro: tipo,
                  habilidad_empirica: String(form.get('habilidad_empirica') ?? ''),
                  descripcion_profesion: String(form.get('descripcion_profesion') ?? ''),
                  cedula: String(form.get('cedula') ?? ''),
                  es_estudiante: esEstudiante,
                  estado: String(form.get('estado') ?? ''),
                  municipio: String(form.get('municipio') ?? ''),
                }
                const parsed = validateOnboardingInput(draft)
                if (!parsed.ok) throw new Error(parsed.error)
                await completeMemberOnboardingFn({ data: { ...draft, ...parsed.value } })
                onCompleted()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo guardar')
              } finally {
                setLoading(false)
              }
            }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              ← Cambiar tipo ({tipo})
            </button>

            {needsProfession && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-purple-200/80">
                    {tipo === 'Oficio'
                      ? 'Tu oficio, habilidad o carrera (si estudias)'
                      : 'Profesión, licenciatura o especialidad'}
                  </span>
                  <input
                    name="habilidad_empirica"
                    required
                    placeholder={
                      tipo === 'Oficio'
                        ? 'Ej. Plomería, Diseño gráfico, Estudiante de Medicina…'
                        : 'Ej. Médico general, Abogado…'
                    }
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-purple-200/80">Descripción breve (opcional)</span>
                  <textarea
                    name="descripcion_profesion"
                    rows={2}
                    className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                    placeholder="Qué ofreces o en qué te formas…"
                  />
                </label>
              </>
            )}

            {(tipo === 'Profesion' || tipo === 'Especialidad' || tipo === 'Oficio') && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-purple-500/20 bg-slate-950/40 px-3 py-3 text-sm text-purple-100">
                <input
                  type="checkbox"
                  checked={esEstudiante}
                  onChange={(e) => setEsEstudiante(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Soy estudiante o pasante y aún no tengo cédula. Me registro como{' '}
                  <strong>Oficio</strong> y pondré en mi perfil que soy estudiante. Me recordarán
                  registrar la cédula cuando la tenga.
                </span>
              </label>
            )}

            {needsCedula && (
              <label className="block text-sm">
                <span className="mb-1 block text-purple-200/80">Cédula profesional</span>
                <input
                  name="cedula"
                  required
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                />
                <span className="mt-1 block text-[11px] text-purple-200/55">
                  Si no la tienes todavía, marca la casilla de estudiante arriba y elige Oficio.
                </span>
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-purple-200/80">Estado (opcional)</span>
                <select
                  name="estado"
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                >
                  <option value="">Selecciona…</option>
                  {MEXICO_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-purple-200/80">Municipio (opcional)</span>
                <input
                  name="municipio"
                  className="w-full rounded-xl border border-purple-500/25 bg-slate-900/60 px-3 py-2.5 text-white"
                />
              </label>
            </div>

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
              {loading ? 'Guardando…' : 'Guardar y entrar a la red'}
            </button>
          </form>
        )}

        {canPostpone && (
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              setError(null)
              try {
                await postponeMemberOnboardingFn()
                onPostponed()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo posponer')
              } finally {
                setLoading(false)
              }
            }}
            className="mt-3 w-full text-center text-xs font-semibold text-purple-300/70 hover:text-amber-200"
          >
            {forced ? 'Más tarde (1–2 veces)' : 'Cerrar por ahora'}
          </button>
        )}
      </div>
    </div>
  )
}
