type ContacNeedLogoProps = {
  className?: string
}

export function ContacNeedLogo({ className = 'h-12 w-12' }: ContacNeedLogoProps) {
  return (
    <img
      src="/contacneed-logo.png"
      alt="ContacNeed"
      className={`cn-logo-metallic object-contain ${className}`}
    />
  )
}
