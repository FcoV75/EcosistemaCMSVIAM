import { createServerFn } from '@tanstack/react-start'
import { getServerUser, getServerProfile, requireAdminUser } from '../lib/auth'

export const getServerUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getServerUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? undefined }
})

export const requireAdminUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await requireAdminUser()
  if (!admin) return null
  return {
    user: { id: admin.user.id, email: admin.user.email ?? undefined },
    profile: admin.profile,
  }
})

export const getServerProfileFn = createServerFn({ method: 'GET' })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    return getServerProfile(userId)
  })
