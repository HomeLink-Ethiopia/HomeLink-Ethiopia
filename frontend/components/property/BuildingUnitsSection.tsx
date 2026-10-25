'use client'

import { useState, useMemo } from 'react'
import type { BuildingDetails, BuildingUnit } from '@/lib/properties'

interface BuildingUnitsSectionProps {
  buildingDetails?: BuildingDetails
  onSelectUnit: (unit: BuildingUnit | null) => void
  selectedUnit: BuildingUnit | null
}

const SPACE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  office_room: { label: 'Private Office / Suite', icon: '🏢' },
  whole_floor: { label: 'Full Floor Lease', icon: '🏗️' },
  entire_building: { label: 'Entire Building', icon: '🏛️' },
  retail_shop: { label: 'Retail / Ground Space', icon: '🛍️' },
  coworking_desk: { label: 'Shared / Coworking Desk', icon: '💻' },
  residential_unit: { label: 'Residential Unit', icon: '🏠' },
}

export default function BuildingUnitsSection({
  buildingDetails,
  onSelectUnit,
  selectedUnit,
}: BuildingUnitsSectionProps) {
  const [filterType, setFilterType] = useState<string>('all')
  const [filterFloor, setFilterFloor] = useState<number | 'all'>('all')

  if (!buildingDetails || !buildingDetails.units || buildingDetails.units.length === 0) {
    return null
  }

  const units = buildingDetails.units

  // Distinct floors available in the building
  const availableFloors = useMemo(() => {
    const floors = Array.from(new Set(units.map((u) => u.floorNumber)))
    return floors.sort((a, b) => a - b)
  }, [units])

  // Count by space type
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: units.length }
    units.forEach((u) => {
      c[u.spaceType] = (c[u.spaceType] || 0) + 1
    })
    return c
  }, [units])

  // Filtered unit list
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const matchType = filterType === 'all' || u.spaceType === filterType
      const matchFloor = filterFloor === 'all' || u.floorNumber === filterFloor
      return matchType && matchFloor
    })
  }, [units, filterType, filterFloor])

  return (
    <div id="building-units" className="mt-8 rounded-xl border border-charcoal/15 bg-white p-6 shadow-sm">
      {/* Header & Strategic Scope */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rust/10 text-base">🏢</span>
            <h2 className="font-display text-xl font-bold text-charcoal">
              Building Units & Available Workspaces
            </h2>
          </div>
          <p className="mt-1 text-sm text-charcoal/70">
            This building supports flexible leasing: rent individual office rooms, a whole floor, or the entire building.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {units.filter((u) => u.status === 'available').length} of {units.length} Spaces Available
          </span>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-charcoal/80">
            {buildingDetails.totalFloors} Floors
          </span>
        </div>
      </div>

      {/* Selected Space Notification Banner */}
      {selectedUnit ? (
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border-2 border-rust bg-rust-tint/50 p-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rust text-white font-bold text-lg">
              ✓
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rust">
                Currently Selected Space
              </p>
              <p className="font-display text-base font-bold text-charcoal">
                {selectedUnit.name || selectedUnit.unitNumber} • {selectedUnit.sizeM2} m² (Floor {selectedUnit.floorNumber === 0 ? 'Ground' : selectedUnit.floorNumber})
              </p>
              <p className="text-xs text-charcoal/70">
                Rent: <span className="font-semibold text-rust">ETB {selectedUnit.monthlyRent?.toLocaleString()}/mo</span> • Lease applications and viewings will be customized for this specific unit.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectUnit(null)}
            className="shrink-0 rounded-md border border-charcoal/20 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-rust hover:text-rust transition-colors"
          >
            Clear Selection (View Full Building)
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg bg-sand/60 border border-charcoal/10 p-3 text-xs text-charcoal/70 flex items-center gap-2">
          <span className="text-base">💡</span>
          <span>
            <strong>Pro Tip:</strong> Click <strong>"Select This Space"</strong> on any room or floor below to customize your rent application and schedule a viewing for that exact unit!
          </span>
        </div>
      )}

      {/* Space Type Filters */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            filterType === 'all'
              ? 'bg-rust text-white shadow-sm'
              : 'border border-charcoal/15 bg-white text-charcoal/80 hover:border-rust'
          }`}
        >
          All Spaces ({counts.all})
        </button>

        {counts.office_room && (
          <button
            type="button"
            onClick={() => setFilterType('office_room')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === 'office_room'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/80 hover:border-rust'
            }`}
          >
            🏢 Office Rooms ({counts.office_room})
          </button>
        )}

        {counts.whole_floor && (
          <button
            type="button"
            onClick={() => setFilterType('whole_floor')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === 'whole_floor'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/80 hover:border-rust'
            }`}
          >
            🏗️ Whole Floors ({counts.whole_floor})
          </button>
        )}

        {counts.entire_building && (
          <button
            type="button"
            onClick={() => setFilterType('entire_building')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === 'entire_building'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/80 hover:border-rust'
            }`}
          >
            🏛️ Full Building ({counts.entire_building})
          </button>
        )}

        {counts.retail_shop && (
          <button
            type="button"
            onClick={() => setFilterType('retail_shop')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filterType === 'retail_shop'
                ? 'bg-rust text-white shadow-sm'
                : 'border border-charcoal/15 bg-white text-charcoal/80 hover:border-rust'
            }`}
          >
            🛍️ Retail / Ground ({counts.retail_shop})
          </button>
        )}
      </div>

      {/* Floor Quick Pills */}
      {availableFloors.length > 1 && (
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-charcoal/60 font-medium shrink-0">Filter by floor:</span>
          <button
            type="button"
            onClick={() => setFilterFloor('all')}
            className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
              filterFloor === 'all'
                ? 'bg-charcoal text-white font-medium'
                : 'bg-sand text-charcoal/70 hover:bg-sand-dark'
            }`}
          >
            All Floors
          </button>
          {availableFloors.map((floor) => (
            <button
              key={floor}
              type="button"
              onClick={() => setFilterFloor(floor)}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                filterFloor === floor
                  ? 'bg-charcoal text-white font-medium'
                  : 'bg-sand text-charcoal/70 hover:bg-sand-dark'
              }`}
            >
              {floor === 0 ? 'Ground Floor' : `Floor ${floor}`}
            </button>
          ))}
        </div>
      )}

      {/* Units Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((u) => {
          const isSelected = selectedUnit?.id === u.id || selectedUnit?.unitNumber === u.unitNumber
          const isRented = u.status === 'rented'
          const typeMeta = SPACE_TYPE_LABELS[u.spaceType] || { label: 'Commercial Unit', icon: '🏢' }

          return (
            <div
              key={u.id || u.unitNumber}
              className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                isSelected
                  ? 'border-rust bg-rust-tint/40 shadow-md ring-2 ring-rust/30'
                  : isRented
                  ? 'border-charcoal/10 bg-gray-50 opacity-60'
                  : 'border-charcoal/15 bg-white hover:border-rust/40 hover:shadow-sm'
              }`}
            >
              <div>
                {/* Badges row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-sand px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                    {typeMeta.icon} {u.floorNumber === 0 ? 'Ground Floor' : `Floor ${u.floorNumber}`}
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

                {/* Unit Name & Size */}
                <h3 className="mt-2.5 font-display text-base font-bold text-charcoal">
                  {u.name || u.unitNumber}
                </h3>
                <p className="text-xs text-charcoal/60">
                  {typeMeta.label} • <strong className="text-charcoal">{u.sizeM2} m²</strong>
                </p>

                {/* Suitable For Tags */}
                {u.suitableFor && u.suitableFor.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {u.suitableFor.map((item, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-sand/80 px-1.5 py-0.5 text-[10px] text-charcoal/70"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Action Button */}
              <div className="mt-4 border-t border-charcoal/10 pt-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-display text-lg font-bold text-rust">
                      ETB {u.monthlyRent?.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-charcoal/60"> / mo</span>
                  </div>
                  {u.depositAmount && (
                    <span className="text-[11px] text-charcoal/60">
                      Dep: ETB {u.depositAmount.toLocaleString()}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isRented}
                  onClick={() => onSelectUnit(isSelected ? null : u)}
                  className={`mt-3 w-full rounded-lg py-2 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-rust text-white shadow-sm hover:bg-rust-dark'
                      : isRented
                      ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                      : 'border border-rust text-rust hover:bg-rust hover:text-white'
                  }`}
                >
                  {isSelected ? '✓ Selected Space' : isRented ? 'Currently Rented' : 'Select This Space'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredUnits.length === 0 && (
        <div className="py-8 text-center text-sm text-charcoal/50">
          No units found matching this filter.
        </div>
      )}
    </div>
  )
}
