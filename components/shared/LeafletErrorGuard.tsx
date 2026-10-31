'use client'
import { useEffect } from 'react'

/**
 * LeafletErrorGuard
 * Catches unhandled browser errors caused by Leaflet unmounting while
 * asynchronous CSS zoom/pan transitions are underway.
 * Leaflet internally invokes `getPosition(this._mapPane)` upon transition end;
 * if React unmounts the component beforehand, `_mapPane` is undefined,
 * throwing "TypeError: Cannot read properties of undefined (reading '_leaflet_pos')".
 */
export default function LeafletErrorGuard() {
  useEffect(() => {
    const isLeafletError = (msg?: string, err?: any) => {
      const combined = `${msg || ''} ${err?.message || ''} ${err?.stack || ''}`
      return (
        combined.includes('_leaflet_pos') ||
        combined.includes('_getMapPanePos') ||
        combined.includes('_onZoomTransitionEnd')
      )
    }

    const handleError = (event: ErrorEvent) => {
      if (isLeafletError(event.message, event.error)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return true
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isLeafletError(event.reason?.message, event.reason)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
