import { createSupabaseServerClient } from './supabase.server'
import { prisma } from './prisma.server'

export async function getServerUser() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function getServerProfile(userId: string) {
  return prisma.perfiles.findUnique({ where: { id: userId } })
}

export async function requireAdminUser() {
  const user = await getServerUser()
  if (!user) return null

  const profile = await getServerProfile(user.id)
  if (!profile?.is_admin) return null

  return { user, profile }
}
