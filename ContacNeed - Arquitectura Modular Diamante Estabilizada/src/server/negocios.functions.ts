import { createServerFn } from '@tanstack/react-start'
import { prisma } from '../lib/prisma.server'
import { getServerUser } from '../lib/auth'

export const getNegocioFn = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    return prisma.negocios.findFirst({ where: { usuario_id: userId } })
  })

export const updateNegocioFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { banner_url?: string; items?: string[] }) => d)
  .handler(async ({ data }) => {
    const user = await getServerUser()
    if (!user) throw new Error('Not authenticated')

    const existing = await prisma.negocios.findFirst({ where: { usuario_id: user.id } })

    if (existing) {
      return prisma.negocios.update({
        where: { id: existing.id },
        data: {
          banner_url: data.banner_url,
          items: data.items ?? [],
        },
      })
    }

    return prisma.negocios.create({
      data: {
        usuario_id: user.id,
        banner_url: data.banner_url,
        items: data.items ?? [],
      },
    })
  })
