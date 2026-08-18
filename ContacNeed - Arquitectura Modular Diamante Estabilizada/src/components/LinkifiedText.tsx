import { Fragment, type ReactNode } from 'react'

const URL_PATTERN =
  /((https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?"')\]])/gi

function normalizeHref(raw: string) {
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
}

/** Convierte URLs en enlaces clicables dentro de texto plano. */
export function LinkifiedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  if (!text) return null

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const pattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags)

  while ((match = pattern.exec(text)) !== null) {
    const start = match.index
    const url = match[0]
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }
    nodes.push(
      <a
        key={`${start}-${url}`}
        href={normalizeHref(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-amber-300 underline decoration-amber-400/50 underline-offset-2 hover:text-amber-200"
      >
        {url}
      </a>,
    )
    lastIndex = start + url.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return (
    <span className={className}>
      {nodes.map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </span>
  )
}
