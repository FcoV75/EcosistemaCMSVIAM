import { getPosts } from '../server/posts.functions'

export async function fetchPublicPosts(estado?: string) {
  return getPosts({ data: { estado: estado?.trim() || undefined } })
}
