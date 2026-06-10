import { createServerFn } from '@tanstack/react-start'
import { prisma } from '../lib/prisma.server'
import { requireAdminUser } from '../lib/auth'
import { mapPublicacionToPost } from '../lib/posts-mapper'

async function assertAdmin() {
  const admin = await requireAdminUser()
  if (!admin) throw new Error('Acceso denegado: se requiere rol de administrador')
  return admin
}

export const getAdminDashboardFn = createServerFn({ method: 'GET' }).handler(async () => {
  await assertAdmin()

  const [posts, users, statsByState] = await Promise.all([
    prisma.publicaciones.findMany({
      orderBy: { fecha_creacion: 'desc' },
      take: 100,
      include: { perfiles: { select: { nombre: true, descripcion_profesion: true } } },
    }),
    prisma.perfiles.findMany({
      orderBy: { fecha_registro: 'desc' },
      take: 100,
    }),
    prisma.perfiles.groupBy({
      by: ['estado'],
      _count: { id: true },
    }),
  ])

  return {
    posts: posts.map(mapPublicacionToPost),
    users,
    statsByState,
    totals: {
      posts: posts.length,
      users: users.length,
    },
  }
})

export const moderatePostFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; estatus: 'aprobado' | 'baneado' | 'pendiente' }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()

    await prisma.publicaciones.update({
      where: { id: data.id },
      data: { estatus: data.estatus },
    })

    return { success: true }
  })

export const deletePostAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()
    await prisma.publicaciones.delete({ where: { id: data.id } })
    return { success: true }
  })

export const updateUserAdminFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { id: string; es_pro?: boolean; is_admin?: boolean }) => d,
  )
  .handler(async ({ data }) => {
    await assertAdmin()

    await prisma.perfiles.update({
      where: { id: data.id },
      data: {
        es_pro: data.es_pro,
        is_admin: data.is_admin,
      },
    })

    return { success: true }
  })

export const banUserAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin()

    await prisma.publicaciones.updateMany({
      where: { usuario_id: data.id },
      data: { estatus: 'baneado' },
    })

    return { success: true }
  })
