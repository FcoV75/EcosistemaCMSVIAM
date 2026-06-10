type ContacNeedLogoProps = {
  className?: string
}

export function ContacNeedLogo({ className = 'h-12 w-12' }: ContacNeedLogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="cn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" stroke="url(#cn-grad)" strokeWidth="6" fill="none" />
      <path
        d="M38 78V42h14c12 0 20 7 20 18s-8 18-20 18H38zm14-28v16h4c5 0 8-3 8-8s-3-8-8-8h-4z"
        fill="url(#cn-grad)"
      />
      <path
        d="M72 42h12l10 22 10-22h12L98 78H86L76 54 66 78H54L72 42z"
        fill="url(#cn-grad)"
      />
    </svg>
  )
}
