/**
 * HomeLink Ethiopia — design tokens
 *
 * Palette (warm/modern, as specified):
 *   rust       #B8451F  primary — CTAs, active nav state, links
 *   rust-dark  #8F3517  hover/pressed state for rust
 *   rust-tint  #EFD9C9  light rust — chip backgrounds, hover fills
 *   charcoal   #2A2521  primary text — warm near-black, not pure #000
 *   cream      #F7F2E7  page background
 *   sand       #EAE0CC  secondary surface — cards, footer, input fills
 *   verified   #3D6B4F  reserved ONLY for verification/trust states
 *                       (verified badges, success states) — never decorative
 *
 * Type:
 *   display — Fraunces, a warm serif with real character. Used for
 *     headings and the wordmark; gives the platform an institutional,
 *     "this is a record you can trust" feel that a geometric sans
 *     would not.
 *   sans — Inter for body copy/UI, falling back to Noto Sans Ethiopic
 *     so the EN/AM toggle renders Amharic correctly on the same stack.
 *   mono — IBM Plex Mono, reserved for verification codes, listing IDs,
 *     and timestamps — small nod to the platform's record-keeping core.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rust: {
          DEFAULT: '#B8451F',
          dark: '#8F3517',
          tint: '#EFD9C9',
        },
        charcoal: '#2A2521',
        cream: '#F7F2E7',
        sand: '#EAE0CC',
        verified: '#3D6B4F',
        gold: '#B8862B', // fourth map-pin/cluster color (lib/properties.ts NEIGHBORHOOD_COLOR)
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: [
          'var(--font-inter)',
          'Noto Sans Ethiopic',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '14px',
      },
      boxShadow: {
        stamp: '0 1px 0 rgba(42,37,33,0.06), 0 6px 16px -8px rgba(184,69,31,0.35)',
      },
      // Notched "seal" corner used sparingly for verification-related
      // elements (badges, the primary CTA) — the platform's one
      // recurring signature device, not applied broadly.
      clipPath: {
        notch: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
      },
    },
  },
  plugins: [],
}
