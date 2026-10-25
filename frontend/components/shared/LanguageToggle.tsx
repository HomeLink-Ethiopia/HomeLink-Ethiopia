'use client'

import { useLanguage } from '@/lib/language-context'

/** Small EN/አማ pill used in dashboard top bars and anywhere a toggle is needed. */
export default function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useLanguage()

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'EN' ? 'AM' : 'EN')}
      aria-label="Switch language"
      title={locale === 'EN' ? 'ወደ አማርኛ ቀይር' : 'Switch to English'}
      className={`shrink-0 rounded px-2.5 py-1.5 font-mono text-xs font-medium transition-colors ${
        dark
          ? 'border border-white/25 text-white/80 hover:border-white hover:text-white'
          : 'border border-charcoal/15 text-charcoal/70 hover:border-rust hover:text-rust'
      }`}
    >
      {locale === 'EN' ? 'EN / አማ' : 'አማ / EN'}
    </button>
  )
}
