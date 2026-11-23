import { createFileRoute } from '@tanstack/react-router'
import { RadioPlayer } from '../components/RadioPlayer'
import { RadioProvider } from '../lib/radio-context'

export const Route = createFileRoute('/radio')({
  head: () => ({
    meta: [{ title: 'Radio IA VIAM | ContacNeed' }],
  }),
  component: RadioPopupPage,
})

function RadioPopupPage() {
  return (
    <RadioProvider>
      <div className="cn-metallic-bg min-h-screen px-4 py-5 text-white">
        <div className="mx-auto max-w-md">
          <div className="mb-4 rounded-2xl border border-purple-500/25 bg-slate-950/50 px-4 py-3 text-center">
            <p className="text-sm font-bold text-amber-300">Radio IA VIAM</p>
            <p className="mt-1 text-[11px] text-purple-200/75">
              Ventana independiente · ciérrala para apagar la música
            </p>
          </div>
          <RadioPlayer />
        </div>
      </div>
    </RadioProvider>
  )
}
