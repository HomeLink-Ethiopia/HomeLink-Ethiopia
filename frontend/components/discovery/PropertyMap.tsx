'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import Image from 'next/image'
import { NEIGHBORHOOD_COLOR, formatEtb, priceLabel, type Property } from '@/lib/properties'

// Global Leaflet monkey-patch to prevent "Cannot read properties of undefined (reading '_leaflet_pos')"
// when map unmounts during a zoom transition or animation
if (typeof window !== 'undefined' && L && L.DomUtil) {
  const origGetPosition = L.DomUtil.getPosition
  L.DomUtil.getPosition = function (el: any) {
    if (!el) {
      return new L.Point(0, 0)
    }
    try {
      return origGetPosition.call(this, el) || new L.Point(0, 0)
    } catch {
      return new L.Point(0, 0)
    }
  }

  if (L.Map && L.Map.prototype) {
    const origGetMapPanePos = (L.Map.prototype as any)._getMapPanePos
    if (origGetMapPanePos) {
      ;(L.Map.prototype as any)._getMapPanePos = function () {
        if (!this._mapPane) {
          return new L.Point(0, 0)
        }
        try {
          return origGetMapPanePos.call(this) || new L.Point(0, 0)
        } catch {
          return new L.Point(0, 0)
        }
      }
    }

    const origOnZoomTransitionEnd = (L.Map.prototype as any)._onZoomTransitionEnd
    if (origOnZoomTransitionEnd) {
      ;(L.Map.prototype as any)._onZoomTransitionEnd = function () {
        if (!this._mapPane || !this._loaded) return
        try {
          origOnZoomTransitionEnd.call(this)
        } catch {
          // Swallow unmounted zoom transition race conditions
        }
      }
    }

    // Fix "Map container is already initialized" during React 18 Fast Refresh / StrictMode / reappearLayoutEffects
    const origInitContainer = (L.Map.prototype as any)._initContainer
    if (origInitContainer) {
      ;(L.Map.prototype as any)._initContainer = function (id: any) {
        const container = L.DomUtil.get(id)
        if (container && (container as any)._leaflet_id) {
          try {
            if ((container as any)._leaflet_map && typeof (container as any)._leaflet_map.remove === 'function') {
              (container as any)._leaflet_map.remove()
            }
          } catch {}
          ;(container as any)._leaflet_id = null
          while (container.firstChild) {
            container.removeChild(container.firstChild)
          }
        }
        const res = origInitContainer.call(this, id)
        if (container) {
          ;(container as any)._leaflet_map = this
        }
        return res
      }
    }
  }
}

const ADDIS_ABABA_CENTER: [number, number] = [9.03, 38.74]

interface PropertyMapProps {
  properties: Property[]
  hoveredId?: string | null
  onHoverChange?: (id: string | null) => void
}

function MapController({ properties }: { properties: Property[] }) {
  const map = useMap()

  useEffect(() => {
    let active = true

    const handleResize = () => {
      if (!active) return
      try {
        map.invalidateSize({ debounceMoveend: true })
      } catch {}
    }

    // Call invalidateSize across multiple rendering stages
    const timers = [
      setTimeout(handleResize, 50),
      setTimeout(handleResize, 150),
      setTimeout(handleResize, 350),
      setTimeout(handleResize, 700),
      setTimeout(handleResize, 1200),
    ]

    window.addEventListener('resize', handleResize)

    // ResizeObserver watches the actual map container DOM node
    let ro: ResizeObserver | null = null
    try {
      const container = map.getContainer()
      if (container && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          handleResize()
        })
        ro.observe(container)
      }
    } catch {}

    if (properties.length > 0) {
      const valid = properties.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng))
      if (valid.length > 0 && active) {
        try {
          const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]))
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false })
        } catch {}
      }
    }

    return () => {
      active = false
      timers.forEach((t) => clearTimeout(t))
      window.removeEventListener('resize', handleResize)
      if (ro) {
        ro.disconnect()
      }
      try {
        map.stop()
      } catch {}
    }
  }, [map, properties])

  return null
}

function priceBubbleIcon(property: Property, isHighlighted: boolean) {
  const color = NEIGHBORHOOD_COLOR[property.neighborhood] || '#B8451F'
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
    className: 'price-pin',
    iconSize: [44, 30],
    iconAnchor: [22, 30],
    popupAnchor: [0, -28],
  })
}

export default function PropertyMap({ properties, hoveredId = null, onHoverChange }: PropertyMapProps) {
  const handleHoverChange = onHoverChange ?? (() => {})
  const markerRefs = useRef<Record<string, L.Marker | null>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    Object.entries(markerRefs.current).forEach(([id, marker]) => {
      if (!marker) return
      try {
        if (id === hoveredId) marker.openPopup()
        else marker.closePopup()
      } catch {}
    })
  }, [hoveredId])

  useEffect(() => {
    return () => {
      if (containerRef.current) {
        const el = containerRef.current.querySelector('.leaflet-container') as any
        if (el) {
          try {
            if (el._leaflet_map && typeof el._leaflet_map.remove === 'function') {
              el._leaflet_map.remove()
            }
          } catch {}
          el._leaflet_id = null
        }
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="h-full w-full">
      <MapContainer
        center={ADDIS_ABABA_CENTER}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <MapController properties={properties} />
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
                {property.image ? (
                  <div className="relative h-28 w-full bg-sand/40">
                    <Image src={property.image} alt={property.title} fill className="object-cover" sizes="224px" />
                    {property.verified && (
                      <span className="absolute left-2 top-2 rounded bg-verified px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Verified
                      </span>
                    )}
                  </div>
                ) : null}
                <div className="p-2.5">
                  <p className="font-display text-sm font-semibold text-charcoal">{property.title}</p>
                  <p className="text-xs text-charcoal/60">{property.neighborhood}, Addis Ababa</p>
                  {property.landlordId && (
                    <p className="mt-1 text-[11px] font-medium text-rust">
                      Listed by: {typeof property.landlordId === 'object' && (property.landlordId as any).legalName ? (property.landlordId as any).legalName : 'Verified Landlord'}
                    </p>
                  )}
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
    </div>
  )
}
