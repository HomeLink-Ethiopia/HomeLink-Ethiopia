'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import Image from 'next/image'
import { NEIGHBORHOOD_COLOR, formatEtb, priceLabel, type Property } from '@/lib/properties'

const ADDIS_ABABA_CENTER: [number, number] = [9.03, 38.74]

interface PropertyMapProps {
  properties: Property[]
  hoveredId?: string | null
  /**
   * Optional — omit this when rendering from a Server Component (e.g.
   * the single-property map on `/property/[id]`). Functions aren't
   * serializable across the server/client boundary, so a Server
   * Component can never pass one in; PropertyMap falls back to a
   * no-op internally instead of requiring every caller to supply one.
   */
  onHoverChange?: (id: string | null) => void
}

/**
 * Builds a custom HTML/CSS "price bubble" marker (no image assets),
 * which sidesteps the classic Next.js + Leaflet issue where the
 * default marker-icon.png/2x/shadow files 404 because the bundler
 * doesn't resolve Leaflet's internal image paths.
 */
function priceBubbleIcon(property: Property, isHighlighted: boolean) {
  const color = NEIGHBORHOOD_COLOR[property.neighborhood]
  const scale = isHighlighted ? 1.15 : 1
  const html = `
    <div style="
      transform: scale(${scale});
      transform-origin: bottom center;
      transition: transform 150ms ease-out, box-shadow 150ms ease-out;
      background:${color};
      color:#fff;
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 999px 999px 999px 2px;
      box-shadow: ${isHighlighted ? '0 8px 16px -4px rgba(0,0,0,0.45)' : '0 2px 6px rgba(0,0,0,0.25)'};
      border: 2px solid rgba(255,255,255,0.9);
      white-space: nowrap;
    ">${priceLabel(property.priceEtb)}</div>
  `
  return L.divIcon({
    html,
    className: 'price-pin', // resets Leaflet's default icon box/border styles, see globals.css
    iconSize: [44, 30],
    iconAnchor: [22, 30],
    popupAnchor: [0, -28],
  })
}

export default function PropertyMap({ properties, hoveredId = null, onHoverChange }: PropertyMapProps) {
  const handleHoverChange = onHoverChange ?? (() => {})
  const markerRefs = useRef<Record<string, L.Marker | null>>({})

  // List-driven hover: open/close the matching marker's popup when the
  // hovered property changes for a reason other than hovering the pin
  // itself (react-leaflet keeps this idempotent either way).
  useEffect(() => {
    Object.entries(markerRefs.current).forEach(([id, marker]) => {
      if (!marker) return
      if (id === hoveredId) marker.openPopup()
      else marker.closePopup()
    })
  }, [hoveredId])

  return (
    <MapContainer
      center={ADDIS_ABABA_CENTER}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[property.lat, property.lng]}
          icon={priceBubbleIcon(property, property.id === hoveredId)}
          ref={(node) => {
            markerRefs.current[property.id] = node
          }}
          eventHandlers={{
            mouseover: () => handleHoverChange(property.id),
            mouseout: () => handleHoverChange(null),
          }}
        >
          <Popup closeButton={false} className="property-pin-popup" minWidth={220}>
            <div className="w-56 overflow-hidden rounded-md">
              <div className="relative h-28 w-full">
                <Image src={property.image} alt={property.title} fill className="object-cover" sizes="224px" />
                {property.verified && (
                  <span className="absolute left-2 top-2 rounded bg-verified px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Verified
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="font-display text-sm font-semibold text-charcoal">{property.title}</p>
                <p className="text-xs text-charcoal/60">{property.neighborhood}, Addis Ababa</p>
                <p className="mt-1 text-sm font-semibold text-charcoal">
                  {formatEtb(property.priceEtb)}
                  <span className="font-sans text-xs font-normal text-charcoal/50"> / month</span>
                </p>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
