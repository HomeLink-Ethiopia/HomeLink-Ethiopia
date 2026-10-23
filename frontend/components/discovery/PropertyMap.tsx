'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import Image from 'next/image'
import { NEIGHBORHOOD_COLOR, formatEtb, priceLabel, type Property } from '@/lib/properties'

// ─── LEAFLET UNMOUNT RACE CONDITION GUARDS ──────────────────────────────────────
// When navigating away from a page or switching views in Next.js while Leaflet is
// animating a zoom or pan transition, Leaflet's internal `_onZoomTransitionEnd`
// timeout fires on an already-unmounted container where `this._mapPane` is undefined.
// Calling `DomUtil.getPosition(undefined)` throws "Cannot read properties of undefined
// (reading '_leaflet_pos')". We harden Leaflet's methods defensively so unmounting
// mid-animation never crashes the app.
if (typeof window !== 'undefined' && L) {
  if (L.DomUtil) {
    const origGetPosition = L.DomUtil.getPosition
    L.DomUtil.getPosition = function (el: any) {
      if (!el) return new L.Point(0, 0)
      try {
        return origGetPosition ? origGetPosition.call(L.DomUtil, el) : ((el && el._leaflet_pos) || new L.Point(0, 0))
      } catch {
        return (el && el._leaflet_pos) || new L.Point(0, 0)
      }
    }
  }

  if (L.Map && L.Map.prototype) {
    const origGetMapPanePos = (L.Map.prototype as any)._getMapPanePos
    ;(L.Map.prototype as any)._getMapPanePos = function () {
      if (!this._mapPane) return new L.Point(0, 0)
      try {
        return origGetMapPanePos ? origGetMapPanePos.call(this) : new L.Point(0, 0)
      } catch {
        return new L.Point(0, 0)
      }
    }

    const origOnZoomTransitionEnd = (L.Map.prototype as any)._onZoomTransitionEnd
    ;(L.Map.prototype as any)._onZoomTransitionEnd = function () {
      if (!this._mapPane || !this._container) return
      try {
        if (origOnZoomTransitionEnd) origOnZoomTransitionEnd.call(this)
      } catch {}
    }
  }
}

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
  view?: string
}

function MapResizer({ view, properties }: { view?: string; properties: Property[] }) {
  const map = useMap()
  const initialFitDone = useRef(false)

  // Stop any pending animations on unmount so callbacks don't fire on detached DOM
  useEffect(() => {
    return () => {
      try {
        map.stop()
      } catch {}
    }
  }, [map])

  // Invalidate size immediately, on timeout, and via ResizeObserver whenever
  // the container dimensions change (e.g. switching between Split and Map views).
  useEffect(() => {
    map.invalidateSize()

    const t1 = setTimeout(() => {
      map.invalidateSize()
    }, 100)

    const t2 = setTimeout(() => {
      map.invalidateSize()
    }, 300)

    const container = map.getContainer()
    if (!container) {
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }

    let rafId: number | null = null
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        map.invalidateSize()
      })
    })

    ro.observe(container)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [map, view])

  // Center on single property or fit bounds on initial load
  useEffect(() => {
    if (properties.length === 1 && properties[0]?.lat && properties[0]?.lng) {
      map.setView([properties[0].lat, properties[0].lng], 14, { animate: false })
    } else if (properties.length > 1 && !initialFitDone.current) {
      initialFitDone.current = true
      const valid = properties
        .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng))
        .map((p) => [p.lat, p.lng] as [number, number])
      if (valid.length > 0) {
        try {
          const bounds = L.latLngBounds(valid)
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: false })
        } catch {}
      }
    }
  }, [map, properties])

  return null
}

/**
 * Builds a custom HTML/CSS "price bubble" marker (no image assets),
 * which sidesteps the classic Next.js + Leaflet issue where the
 * default marker-icon.png/2x/shadow files 404 because the bundler
 * doesn't resolve Leaflet's internal image paths.
 */
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
    className: 'price-pin', // resets Leaflet's default icon box/border styles, see globals.css
    iconSize: [44, 30],
    iconAnchor: [22, 30],
    popupAnchor: [0, -28],
  })
}

export default function PropertyMap({ properties, hoveredId = null, onHoverChange, view }: PropertyMapProps) {
  const handleHoverChange = onHoverChange ?? (() => {})
  const markerRefs = useRef<Record<string, L.Marker | null>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Guard against Leaflet's "Map container is already initialized" error:
  // react-leaflet v4 leaks the map binding on unmount (it never calls
  // map.remove()), so in React 18 StrictMode / Fast Refresh remounts the
  // stale `_leaflet_id` on the inner .leaflet-container div makes the next
  // L.map() throw. Child effect cleanups run before ours, so by the time
  // this runs react-leaflet is done and we can safely drop the stale id.
  useEffect(() => {
    return () => {
      const root = containerRef.current
      if (!root) return
      if ((root as any)._leaflet_id != null) {
        delete (root as any)._leaflet_id
      }
      root.querySelectorAll('.leaflet-container').forEach((el) => {
        if ((el as any)._leaflet_id != null) {
          delete (el as any)._leaflet_id
        }
      })
    }
  }, [])

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

  const initialCenter = properties.length === 1 && properties[0]?.lat && properties[0]?.lng
    ? [properties[0].lat, properties[0].lng] as [number, number]
    : ADDIS_ABABA_CENTER

  return (
    <div ref={containerRef} className="h-full w-full" style={{ minHeight: '100%', height: '100%', width: '100%' }}>
    <MapContainer
      center={initialCenter}
      zoom={13}
      scrollWheelZoom
      zoomAnimation={false}
      fadeAnimation={false}
      className="h-full w-full"
      style={{ minHeight: '100%', height: '100%', width: '100%' }}
    >
      <MapResizer view={view} properties={properties} />
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
    </div>
  )
}
