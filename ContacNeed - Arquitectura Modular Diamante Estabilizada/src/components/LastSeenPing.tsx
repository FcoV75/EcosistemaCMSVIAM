import { useEffect } from 'react'
import { pingLastSeenFn } from '../server/social.functions'

export function LastSeenPing() {
  useEffect(() => {
    pingLastSeenFn().catch(() => {})
    const interval = setInterval(() => {
      pingLastSeenFn().catch(() => {})
    }, 120000)
    return () => clearInterval(interval)
  }, [])

  return null
}
