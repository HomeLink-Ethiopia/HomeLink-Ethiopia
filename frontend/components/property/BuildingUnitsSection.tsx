'use client'

import { useState, useMemo } from 'react'
import type { BuildingDetails, BuildingUnit } from '@/lib/properties'

interface BuildingUnitsSectionProps {
  buildingDetails?: BuildingDetails
  onSelectUnit: (unit: BuildingUnit | null) => void
  selectedUnit: BuildingUnit | null
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  office_room: 'Private Office Suite',
  whole_floor: 'Full Floor Lease',
  entire_building: 'Entire Commercial Tower',
  retail_shop: 'Ground Retail Space',
  coworking_desk: 'Shared / Coworking Desk',
  residential_unit: 'Residential Unit',
}

export default function BuildingUnitsSection({
  buildingDetails,
  onSelectUnit,
  selectedUnit,
}: BuildingUnitsSectionProps) {
  const [viewMode, setViewMode] = useState<'by_floor' | 'all_list'>('by_floor')

  if (!buildingDetails || !buildingDetails.units || buildingDetails.units.length === 0) {
    return null
  }

  const units = buildingDetails.units

  // Distinct floors sorted numerically: 0 (Ground), 1, 2, 3...
  const availableFloors = useMemo(() => {
    const floorSet = new Set(units.map((u) => (typeof u.floorNumber === 'number' ? u.floorNumber : 1)))
    return Array.from(floorSet).sort((a, b) => a - b)
  }, [units])

  // Default active floor to the first floor that has rooms (or ground floor)
  const [selectedFloor, setSelectedFloor] = useState<number>(() => {
    if (availableFloors.length > 0) return availableFloors[0]
    return 1
  })

  // Separate entire-building lease unit if present
  const fullBuildingUnit = useMemo(() => {
    return units.find((u) => u.spaceType === 'entire_building')
  }, [units])

  // Units grouped by floor (excluding full building unit from room list)
  const floorRoomUnits = useMemo(() => {
    return units.filter((u) => u.spaceType !== 'entire_building')
  }, [units])

  // Rooms on the currently selected floor
  const roomsOnActiveFloor = useMemo(() => {
    return floorRoomUnits.filter((u) => {
      const fNum = typeof u.floorNumber === 'number' ? u.floorNumber : 1
      return fNum === selectedFloor
    })
  }, [floorRoomUnits, selectedFloor])

  // Count available rooms
  const totalAvailableCount = units.filter((u) => u.status === 'available').length

  function getFloorTitle(floor: number) {
    if (floor === 0) return 'Ground Floor'
    if (floor === 1) return '1st Floor'
    if (floor === 2) return '2nd Floor'
    if (floor === 3) return '3rd Floor'
    return `Floor ${floor}`
  }

  function normalizeUnit(u: BuildingUnit, idx: number): BuildingUnit {
    const uId = u.id || (u as any).unitId || (u as any)._id || u.unitNumber || `unit-${idx}`
    const rentPrice = u.monthlyRent ?? (u as any).rentAmount ?? 0
    const depositPrice = u.depositAmount ?? rentPrice * 2

    return {
      ...u,
      id: uId,
      unitId: uId,
      unitNumber: u.unitNumber || `Unit ${idx + 1}`,
      name: u.name || u.unitNumber || `Unit ${idx + 1}`,
      spaceType: u.spaceType || 'office_room',
      floorNumber: typeof u.floorNumber === 'number' ? u.floorNumber : 0,
      sizeM2: u.sizeM2 || 0,
      monthlyRent: rentPrice,
      rentAmount: rentPrice,
      depositAmount: depositPrice,
      suitableFor: u.suitableFor || [],
      status: u.status || 'available',
    }
  }

  return (
    <div id="building-units" className="mt-8 rounded-2xl border border-charcoal/15 bg-white p-5 sm:p-7 shadow-sm space-y-6">
      {/* ─── 1. Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-5">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-charcoal">
            Building Floors & Available Units
          </h2>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-0.5">
            Select a floor to view available office suites, ground retail, or whole-floor spaces.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {totalAvailableCount} of {units.length} Units Available
          </span>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-charcoal/80">
            {buildingDetails.totalFloors || availableFloors.length} Floors Total
          </span>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg bg-sand/80 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('by_floor')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'by_floor'
                  ? 'bg-rust text-white shadow-xs'
                  : 'text-charcoal/70 hover:text-charcoal'
              }`}
            >
              Floor by Floor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all_list')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'all_list'
                  ? 'bg-rust text-white shadow-xs'
                  : 'text-charcoal/70 hover:text-charcoal'
              }`}
            >
              All Units
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Selected Room Confirmation Banner ─── */}
      {selectedUnit ? (
        <div className="rounded-xl border-2 border-rust bg-rust-tint/40 p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rust text-white font-bold text-lg shadow-xs">
              ✓
            </div>
            <div>
              <span className="inline-block rounded bg-rust px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Selected Unit
              </span>
              <p className="font-display text-base sm:text-lg font-bold text-charcoal mt-0.5">
                {selectedUnit.name || selectedUnit.unitNumber} • {selectedUnit.sizeM2} m² on {getFloorTitle(selectedUnit.floorNumber)}
              </p>
              <p className="text-xs text-charcoal/80">
                Monthly Rent: <strong className="font-bold text-rust">ETB {(selectedUnit.monthlyRent ?? (selectedUnit as any).rentAmount ?? 0).toLocaleString()}/mo</strong>
                {' • '}Ready to apply or schedule a private viewing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectUnit(null)}
            className="shrink-0 rounded-lg border border-charcoal/20 bg-white px-3.5 py-2 text-xs font-bold text-charcoal hover:border-rust hover:text-rust transition-all cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-sand/40 border border-charcoal/10 p-3.5 text-xs text-charcoal/70 flex items-center gap-2.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-rust shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            Select a floor below to view its floor plan, rooms, and lease rates. Click <strong>"Select Unit to Rent"</strong> on any space to proceed with an application or tour.
          </div>
        </div>
      )}

      {/* ─── 3. Full Building Lease Card (Optional) ─── */}
      {fullBuildingUnit && (
        <div className="rounded-xl border border-charcoal/15 bg-sand/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/60">
              Corporate Master Lease Option
            </span>
            <h3 className="font-display text-base font-bold text-charcoal mt-0.5">
              {fullBuildingUnit.name || 'Entire Commercial Tower'}
            </h3>
            <p className="text-xs text-charcoal/70">
              {fullBuildingUnit.sizeM2} m² • All {buildingDetails.totalFloors} Floors • Suitable for Headquarters, Embassies, or Institutions.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
            <div className="text-right">
              <span className="font-display text-base font-bold text-rust">
                ETB {(fullBuildingUnit.monthlyRent ?? (fullBuildingUnit as any).rentAmount ?? 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-charcoal/60"> / mo</span>
            </div>

            <button
              type="button"
              onClick={() => onSelectUnit(normalizeUnit(fullBuildingUnit, 999))}
              className="rounded-lg bg-charcoal px-3.5 py-2 text-xs font-bold text-white hover:bg-rust transition-colors cursor-pointer"
            >
              Select Full Building
            </button>
          </div>
        </div>
      )}

      {/* ─── 4. FLOOR BY FLOOR VIEW ─── */}
      {viewMode === 'by_floor' && (
        <div className="space-y-6">
          {/* STEP 1: Floor Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal/80">
                1. Select Floor Level
              </h3>
              <span className="text-xs text-charcoal/50">
                Click a floor to display its units
              </span>
            </div>

            {/* Floor Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {availableFloors.map((floor) => {
                const floorUnits = floorRoomUnits.filter((u) => (typeof u.floorNumber === 'number' ? u.floorNumber : 1) === floor)
                const availableOnFloor = floorUnits.filter((u) => u.status === 'available').length
                const isSelectedFloor = selectedFloor === floor
                const lowestRent = Math.min(...floorUnits.map((u) => u.monthlyRent ?? (u as any).rentAmount ?? 0).filter(Boolean))

                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => setSelectedFloor(floor)}
                    className={`relative flex flex-col p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelectedFloor
                        ? 'border-rust bg-rust-tint/25 shadow-xs ring-2 ring-rust/30'
                        : 'border-charcoal/15 bg-white hover:border-rust/40 hover:bg-sand/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-display text-sm font-bold text-charcoal">
                        {getFloorTitle(floor)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          availableOnFloor > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {availableOnFloor > 0 ? `${availableOnFloor} Available` : 'Occupied'}
                      </span>
                    </div>

                    <p className="text-xs text-charcoal/50 mt-1">
                      {floorUnits.length} space{floorUnits.length === 1 ? '' : 's'}
                    </p>

                    {lowestRent > 0 && isFinite(lowestRent) && (
                      <p className="text-xs font-bold text-rust mt-2">
                        From ETB {lowestRent.toLocaleString()} <span className="text-[10px] font-normal text-charcoal/50">/mo</span>
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* STEP 2: Rooms on the Chosen Floor */}
          <div className="rounded-xl border border-charcoal/15 bg-sand/15 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-charcoal">
                  Available Spaces on {getFloorTitle(selectedFloor)}
                </h3>
                <p className="text-xs text-charcoal/60">
                  {roomsOnActiveFloor.length} unit{roomsOnActiveFloor.length === 1 ? '' : 's'} configured on this level.
                </p>
              </div>

              <span className="text-xs font-semibold text-charcoal/70 bg-white px-2.5 py-1 rounded-md border border-charcoal/10">
                {getFloorTitle(selectedFloor)}
              </span>
            </div>

            {/* Room Cards Grid */}
            {roomsOnActiveFloor.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomsOnActiveFloor.map((u, idx) => {
                  const normalized = normalizeUnit(u, idx)
                  const uId = normalized.id
                  const selectedId = selectedUnit ? (selectedUnit.id || (selectedUnit as any).unitId || (selectedUnit as any)._id || selectedUnit.unitNumber) : null
                  
                  const isSelected = Boolean(
                    selectedUnit &&
                    ((selectedId && uId && selectedId === uId) ||
                     (selectedUnit.unitNumber && u.unitNumber && selectedUnit.unitNumber === u.unitNumber))
                  )
                  const isRented = u.status === 'rented'
                  const typeLabel = SPACE_TYPE_LABELS[u.spaceType] || 'Private Workspace'
                  const rentPrice = normalized.monthlyRent
                  const depositPrice = normalized.depositAmount || rentPrice * 2

                  return (
                    <div
                      key={uId}
                      className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all bg-white ${
                        isSelected
                          ? 'border-rust ring-2 ring-rust/30 shadow-md bg-rust-tint/15'
                          : isRented
                          ? 'border-charcoal/10 opacity-60 bg-gray-50'
                          : 'border-charcoal/15 hover:border-rust/40 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Room Image */}
                        {u.image && (
                          <div className="relative mb-3 h-36 w-full overflow-hidden rounded-xl bg-sand/30 border border-charcoal/10">
                            <img src={u.image} alt={u.name || u.unitNumber} className="h-full w-full object-cover" />
                            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                              {u.unitNumber}
                            </span>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-sand px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                            {typeLabel}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              u.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.status === 'reserved'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {u.status === 'available' ? 'Available' : u.status === 'reserved' ? 'Reserved' : 'Rented'}
                          </span>
                        </div>

                        {/* Room Number & Title */}
                        <h4 className="mt-2.5 font-display text-base font-bold text-charcoal">
                          {u.name || u.unitNumber}
                        </h4>

                        <p className="text-xs text-charcoal/60 mt-0.5">
                          Size: <strong className="text-charcoal font-bold">{u.sizeM2} m²</strong>
                          {u.floorNumber !== undefined && (
                            <span className="ml-1.5">• {u.floorNumber === 0 ? 'Ground' : `Floor ${u.floorNumber}`}</span>
                          )}
                        </p>

                        {/* Suitable For Tags */}
                        {u.suitableFor && u.suitableFor.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {u.suitableFor.map((tag, tagIdx) => (
                              <span
                                key={tagIdx}
                                className="rounded bg-sand/80 px-1.5 py-0.5 text-[10px] text-charcoal/70"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Pricing & Selection Button */}
                      <div className="mt-4 border-t border-charcoal/10 pt-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="font-display text-lg font-bold text-rust">
                              ETB {rentPrice.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-charcoal/60"> / mo</span>
                          </div>
                          {depositPrice > 0 && (
                            <span className="text-[11px] text-charcoal/60">
                              Dep: ETB {depositPrice.toLocaleString()}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isRented}
                          onClick={() => onSelectUnit(isSelected ? null : normalized)}
                          className={`mt-3 w-full rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rust text-white shadow-sm hover:bg-rust-dark'
                              : isRented
                              ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                              : 'border border-rust text-rust hover:bg-rust hover:text-white'
                          }`}
                        >
                          {isSelected
                            ? 'Selected (Click to cancel)'
                            : isRented
                            ? 'Currently Occupied'
                            : `Select ${u.unitNumber} to Rent`}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-white rounded-xl border border-dashed border-charcoal/20">
                <p className="text-sm font-semibold text-charcoal/60">
                  No rooms configured on {getFloorTitle(selectedFloor)}.
                </p>
                <p className="text-xs text-charcoal/40 mt-1">
                  Please select another floor level above.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 5. ALL ROOMS LIST VIEW ─── */}
      {viewMode === 'all_list' && (
        <div className="space-y-3">
          <p className="text-xs text-charcoal/60">
            Showing all spaces across all building floors:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map((u, idx) => {
              const normalized = normalizeUnit(u, idx)
              const uId = normalized.id
              const isSelected = Boolean(selectedUnit && selectedUnit.id === uId)
              const isRented = u.status === 'rented'
              const rentPrice = normalized.monthlyRent

              return (
                <div
                  key={uId}
                  className={`rounded-xl border p-4 transition-all bg-white flex flex-col justify-between ${
                    isSelected ? 'border-rust ring-2 ring-rust/30 bg-rust-tint/20' : 'border-charcoal/15'
                  }`}
                >
                  <div>
                    {u.image && (
                      <div className="relative mb-2.5 h-28 w-full overflow-hidden rounded-lg bg-sand/30 border border-charcoal/10">
                        <img src={u.image} alt={u.name || u.unitNumber} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-charcoal">
                        {u.floorNumber === 0 ? 'Ground Floor' : `Floor ${u.floorNumber}`}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    <h4 className="font-display text-sm font-bold text-charcoal mt-2">
                      {u.name || u.unitNumber}
                    </h4>
                    <p className="text-xs text-charcoal/60">{u.sizeM2} m²</p>
                  </div>

                  <div className="mt-3 border-t border-charcoal/10 pt-2 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-rust">
                      ETB {rentPrice.toLocaleString()} <span className="font-sans text-[10px] font-normal text-charcoal/60">/mo</span>
                    </span>

                    <button
                      type="button"
                      disabled={isRented}
                      onClick={() => onSelectUnit(isSelected ? null : normalized)}
                      className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-rust text-white'
                          : isRented
                          ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                          : 'border border-rust text-rust hover:bg-rust hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Selected' : isRented ? 'Occupied' : 'Select'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
