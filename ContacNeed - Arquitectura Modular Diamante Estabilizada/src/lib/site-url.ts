export function getSiteUrl() {
  const raw =
    process.env.SITE_URL ??
    process.env.VITE_SITE_URL ??
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    'https://contacneed.com'

  return raw.replace(/\/$/, '')
}
