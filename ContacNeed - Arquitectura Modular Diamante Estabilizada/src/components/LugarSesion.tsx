export function LugarSesion({ valor }: { valor?: string | null }) {
  const texto = String(valor || '').trim()
  if (!texto) return null

  const esUrl = /^https?:\/\//i.test(texto)
  if (esUrl) {
    return (
      <p className="mt-1 text-sm text-sky-100">
        Liga de la sesión:{' '}
        <a href={texto} target="_blank" rel="noreferrer" className="font-semibold underline">
          Abrir Zoom o sala
        </a>
      </p>
    )
  }

  return <p className="mt-1 text-sm text-slate-200">Lugar: {texto}</p>
}
