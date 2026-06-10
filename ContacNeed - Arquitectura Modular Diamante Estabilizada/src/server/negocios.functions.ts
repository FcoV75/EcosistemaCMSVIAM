import { createServerFn } from '@tanstack/react-start'
import { prisma } from '../lib/prisma.server'
import { getServerUser } from '../lib/auth'

export const getNegocioFn = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    return prisma.negocios.findUnique({ where: { id: userId } })
  })

export const updateNegocioFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { banner_url?: string; items?: string[] }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Not authenticated')

    return prisma.negocios.upsert({
      where: { id: user.id },
      update: {
        banner_url: data.banner_url,
        items: data.items ?? [],
      },
      create: {
        id: user.id,
        banner_url: data.banner_url,
        items: data.items ?? [],
      },
    })
  })
