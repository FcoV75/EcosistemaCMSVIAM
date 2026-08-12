import type { SupabaseClient } from '@supabase/supabase-js'

/** Genera códigos CMS-XXXXXX únicos (mismo formato que verify-payment del CMS). */
export function generarCodigoCmsCandidate() {
  return 'CMS-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * Reutiliza un código existente del usuario/correo o crea uno nuevo.
 * Unifica ContacNeed PRO, Nexus, Video Diamante y Promotores.
 */
export async function ensureLegacyCmsCode(
  supabase: SupabaseClient,
  {
    userId,
    email,
  }: {
    userId?: string | null
    email?: string | null
  },
) {
  const mail = String(email || '')
    .trim()
    .toLowerCase()

  if (userId) {
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('legacy_code')
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('legacy_code', 'is', null)
      .limit(20)

    const existing = (data || []).find((r) => r.legacy_code)?.legacy_code
    if (existing) return String(existing).toUpperCase()
  }

  if (mail) {
    const { data } = await supabase
      .from('ecosistema_entitlements')
      .select('legacy_code, metadata')
      .eq('status', 'active')
      .not('legacy_code', 'is', null)
      .limit(300)

    const match = (data || []).find(
      (r) =>
        String((r.metadata as { email?: string } | null)?.email || '')
          .trim()
          .toLowerCase() === mail,
    )
    if (match?.legacy_code) return String(match.legacy_code).toUpperCase()
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generarCodigoCmsCandidate()
    const { data: collision } = await supabase
      .from('ecosistema_entitlements')
      .select('id')
      .eq('legacy_code', code)
      .limit(1)
      .maybeSingle()
    if (!collision?.id) return code
  }

  throw new Error('No se pudo generar un código CMS único. Intenta de nuevo.')
}
