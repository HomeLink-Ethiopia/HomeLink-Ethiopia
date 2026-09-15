'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface PropertyGalleryProps {
  images: string[]
  alt: string
  verified?: boolean
}

const THUMB_COUNT = 5

/**
 * Hero image + a strip of thumbnails below. The last thumbnail shows
 * "+N" overlay if there are more images. Clicking any image opens a
 * fullscreen lightbox with arrow navigation and Esc/backdrop to close.
 */
export default function PropertyGallery({ images, alt, verified }: PropertyGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const close = useCallback(() => setLightboxIndex(null), [])
  const next = useCallback(
    () => setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length]
  )
  const prev = useCallback(
    () => setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length]
  )

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, close, next, prev])

  // Show first 5 thumbnails, with "+N" on the last one if more images exist
  const thumbs = images.slice(0, THUMB_COUNT)
  const remaining = images.length - THUMB_COUNT

  return (
    <>
      <div>
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="group relative block aspect-[16/10] w-full overflow-hidden rounded-lg"
        >
          <Image
            src={images[0]}
            alt={alt}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          {verified && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded bg-verified px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path
                  fillRule="evenodd"
                  d="M10 1.5l6.5 2.9v5c0 4.6-2.8 8.7-6.5 9.9-3.7-1.2-6.5-5.3-6.5-9.9v-5L10 1.5zm3.4 6.4a.75.75 0 00-1.1-1L9 10.2 7.7 8.9a.75.75 0 10-1 1.1l1.8 1.8c.3.3.8.3 1 0l3.9-3.9z"
                  clipRule="evenodd"
                />
              </svg>
              Verified Property
            </span>
          )}
        </button>

        {/* Thumbnail strip below main image */}
        {thumbs.length > 0 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {thumbs.map((src, i) => {
              const isLastVisible = i === thumbs.length - 1 && remaining > 0
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-md border-2 border-transparent transition-all hover:border-rust"
                >
                  <Image src={src} alt="" fill sizes="150px" className="object-cover transition-transform group-hover:scale-105" />
                  {isLastVisible && (
                    <span className="absolute inset-0 flex items-center justify-center bg-charcoal/70 text-base font-bold text-white transition-colors group-hover:bg-charcoal/80">
                      +{remaining}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/95 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            onClick={close}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close photo viewer"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path d="M8 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <motion.div
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="relative h-[70vh] w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={images[lightboxIndex]}
                alt={`${alt} — photo ${lightboxIndex + 1} of ${images.length}`}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </motion.div>

            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-xs text-white/70">
              {lightboxIndex + 1} / {images.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
