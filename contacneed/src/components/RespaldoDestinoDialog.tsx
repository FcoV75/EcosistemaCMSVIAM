import { useRef, useState } from 'react'
import {
  Cloud,
  Download,
  ExternalLink,
  FileJson,
  HardDrive,
  Loader2,
  Usb,
  X,
} from 'lucide-react'
import { uploadFileToCloudinary } from '../lib/cloudinary-upload'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  filename: string
  /** JSON u objeto serializable; se convierte a Blob */
  getPayload: () => Promise<unknown> | unknown
  busyLabel?: string
}

function toJsonBlob(payload: unknown): Blob {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  return new Blob([text], { type: 'application/json' })
}

async function downloadBlob(blob: Blob, filename: string) {
  // File System Access API: permite elegir carpeta, disco o USB
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string
      types?: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<FileSystemFileHandle>
  }
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'JSON',
            accept: { 'application/json': ['.json'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'picker' as const
    } catch (e) {
      // Usuario canceló el picker
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled' as const
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'download' as const
}

const CLOUD_TARGETS = [
  {
    id: 'gdrive',
    label: 'Google Drive',
    url: 'https://drive.google.com/drive/my-drive',
    hint: 'Se descarga el archivo y se abre Drive para que lo subas a tu carpeta.',
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    url: 'https://www.dropbox.com/home',
    hint: 'Se descarga el archivo y se abre Dropbox para subirlo a tu nube.',
  },
  {
    id: 'onedrive',
    label: 'OneDrive',
    url: 'https://onedrive.live.com/',
    hint: 'Se descarga el archivo y se abre OneDrive para guardarlo donde quieras.',
  },
] as const

export function RespaldoDestinoDialog({
  open,
  onClose,
  title = '¿Dónde guardamos el respaldo?',
  filename,
  getPayload,
  busyLabel = 'Preparando respaldo…',
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cloudUrl, setCloudUrl] = useState<string | null>(null)
  const copyRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const run = async (action: string, fn: (blob: Blob) => Promise<void>) => {
    setError(null)
    setBusy(action)
    try {
      const payload = await getPayload()
      const blob = toJsonBlob(payload)
      await fn(blob)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el respaldo')
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'flex w-full items-start gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-left transition hover:border-cyan-400/40 hover:bg-slate-900/70 disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
        <div className="mb-4 flex items-center gap-2 pr-8">
          <FileJson className="text-cyan-300" size={20} />
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400">
              Elige equipo, USB o tu nube personal. El archivo es JSON cifrado solo por tu control de acceso.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className={btn}
            disabled={Boolean(busy)}
            onClick={() =>
              void run('equipo', async (blob) => {
                const mode = await downloadBlob(blob, filename)
                if (mode === 'cancelled') return
                if (mode === 'picker') {
                  window.alert('Respaldo guardado en la ubicación que elegiste (equipo, disco o USB).')
                } else {
                  window.alert(
                    'Descarga iniciada. En el diálogo del navegador elige carpeta, Disco o USB.',
                  )
                }
              })
            }
          >
            <HardDrive className="mt-0.5 shrink-0 text-emerald-300" size={18} />
            <span>
              <span className="block text-sm font-semibold text-white">Equipo / carpeta</span>
              <span className="block text-[11px] text-slate-400">
                Guarda el JSON en tu computadora. Si el navegador lo permite, eliges la carpeta.
              </span>
            </span>
            {busy === 'equipo' && <Loader2 className="ml-auto animate-spin text-slate-300" size={16} />}
          </button>

          <button
            type="button"
            className={btn}
            disabled={Boolean(busy)}
            onClick={() =>
              void run('usb', async (blob) => {
                const mode = await downloadBlob(blob, filename)
                if (mode === 'cancelled') return
                window.alert(
                  mode === 'picker'
                    ? 'Elige tu unidad USB en el diálogo y confirma para guardar el expediente ahí.'
                    : 'Conecta tu USB y, en el diálogo de descarga, selecciona la unidad USB como destino.',
                )
              })
            }
          >
            <Usb className="mt-0.5 shrink-0 text-amber-300" size={18} />
            <span>
              <span className="block text-sm font-semibold text-white">USB / memoria externa</span>
              <span className="block text-[11px] text-slate-400">
                Ideal para respaldo físico. Elige la unidad USB al guardar.
              </span>
            </span>
            {busy === 'usb' && <Loader2 className="ml-auto animate-spin text-slate-300" size={16} />}
          </button>

          <button
            type="button"
            className={btn}
            disabled={Boolean(busy)}
            onClick={() =>
              void run('contacneed', async (blob) => {
                const file = new File([blob], filename, { type: 'application/json' })
                const url = await uploadFileToCloudinary(file)
                setCloudUrl(url)
                window.open(url, '_blank', 'noopener,noreferrer')
              })
            }
          >
            <Cloud className="mt-0.5 shrink-0 text-cyan-300" size={18} />
            <span>
              <span className="block text-sm font-semibold text-white">Nube ContacNeed (segura)</span>
              <span className="block text-[11px] text-slate-400">
                Sube a Cloudinary del ecosistema y te deja el enlace para conservarlo.
              </span>
            </span>
            {busy === 'contacneed' && <Loader2 className="ml-auto animate-spin text-slate-300" size={16} />}
          </button>

          {CLOUD_TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={btn}
              disabled={Boolean(busy)}
              onClick={() =>
                void run(t.id, async (blob) => {
                  await downloadBlob(blob, filename)
                  window.open(t.url, '_blank', 'noopener,noreferrer')
                  window.alert(`${t.hint}\n\nArchivo: ${filename}`)
                })
              }
            >
              <ExternalLink className="mt-0.5 shrink-0 text-violet-300" size={18} />
              <span>
                <span className="block text-sm font-semibold text-white">{t.label}</span>
                <span className="block text-[11px] text-slate-400">{t.hint}</span>
              </span>
              {busy === t.id && <Loader2 className="ml-auto animate-spin text-slate-300" size={16} />}
            </button>
          ))}
        </div>

        {cloudUrl && (
          <div className="mt-3 space-y-1 rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-3">
            <p className="text-[11px] font-semibold text-cyan-200">Enlace nube ContacNeed</p>
            <div className="flex gap-2">
              <input
                ref={copyRef}
                readOnly
                value={cloudUrl}
                className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-slate-200"
              />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/10"
                onClick={() => {
                  void navigator.clipboard.writeText(cloudUrl)
                }}
              >
                <Download size={12} /> Copiar
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
        {busy && !error && <p className="mt-3 text-xs text-slate-400">{busyLabel}</p>}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-white/15 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
