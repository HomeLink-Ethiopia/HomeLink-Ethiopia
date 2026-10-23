'use client'

import { useState } from 'react'

export default function AboutSection({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = description.length > 140
  const preview = isLong ? `${description.slice(0, 140).trimEnd()}…` : description

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-charcoal">About this home</h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{expanded ? description : preview}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-sm font-medium text-rust hover:text-rust-dark"
        >
          {expanded ? 'Show less' : 'Read more'} →
        </button>
      )}
    </div>
  )
}
