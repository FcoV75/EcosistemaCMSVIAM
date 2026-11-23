import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { fetchActiveAds } from '../lib/ads-client'
import type { MexicoState } from '../lib/mexico-states'

type TopBannerBarProps = {
  selectedState: MexicoState | ''
}

export function TopBannerBar({ selectedState }: TopBannerBarProps) {
  const adsQuery = useQuery({
    queryKey: ['banner-ads', selectedState],
    queryFn: () => fetchActiveAds(selectedState || undefined, 'banner'),
    staleTime: 60_000,
  })

  const banners = adsQuery.data ?? []
  if (banners.length === 0) return null

  return (
    <div className="border-b border-amber-500/20 bg-gradient-to-r from-purple-950/90 via-slate-900/95 to-amber-950/40">
      <div className="mx-auto flex max-w-[90rem] items-center gap-3 overflow-x-auto px-4 py-2 lg:px-6">
        <Megaphone size={16} className="shrink-0 text-amber-400" aria-hidden />
        <div className="flex min-w-0 flex-1 gap-4">
          {banners.map((ad) => (
            <BannerItem key={ad.id} ad={ad} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BannerItem({ ad }: { ad: { id: string; titulo: string; cuerpo?: string | null; enlace_url?: string | null } }) {
  const content = (
    <>
      <span className="font-bold text-amber-300">{ad.titulo}</span>
      {ad.cuerpo ? <span className="text-purple-100/80"> — {ad.cuerpo}</span> : null}
    </>
  )

  if (ad.enlace_url) {
    return (
      <a
        href={ad.enlace_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 whitespace-nowrap text-xs hover:text-amber-200 sm:text-sm"
      >
        {content}
      </a>
    )
  }

  return <p className="shrink-0 whitespace-nowrap text-xs sm:text-sm">{content}</p>
}
