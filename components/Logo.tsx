import Image from 'next/image'
import Link from 'next/link'

interface LogoProps {
  className?: string
  width?: number
  height?: number
  href?: string
}

export default function Logo({ className = '', width = 180, height = 45, href = '/' }: LogoProps) {
  const logo = (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rust">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3L4 9V19H8V13H16V19H20V9L12 3Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          <rect x="10" y="15" width="4" height="4" fill="#B8451F"/>
        </svg>
      </div>
      <span className="font-display text-xl font-bold text-charcoal">
        HomeLink <span className="text-rust">Ethiopia</span>
      </span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {logo}
      </Link>
    )
  }

  return logo
}
