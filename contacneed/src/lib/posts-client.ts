import { getPosts } from '../server/posts.functions'

export const FEED_PAGE_SIZE = 8

export async function fetchPublicPosts(
  estado?: string,
  page: { offset?: number; limit?: number } = {},
) {
  return getPosts({
    data: {
      estado: estado?.trim() || undefined,
      offset: page.offset ?? 0,
      limit: page.limit ?? FEED_PAGE_SIZE,
    },
  })
}
