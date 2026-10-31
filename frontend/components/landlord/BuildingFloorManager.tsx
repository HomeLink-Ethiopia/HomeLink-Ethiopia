'use client'

import { useState, useId } from 'react'
import type { BuildingDetails, BuildingUnit } from '@/lib/properties'

interface BuildingFloorManagerProps {
  initialDetails?: BuildingDetails
  onChange: (details: BuildingDetails) => void
  baseRent?: number
}

const SPACE_TYPES: Array<{ value: BuildingUnit['spaceType']; label: string }> = [
  { value: 'office_room', label: 'Private Office / Suite (የቢሮ ክፍል)' },
  { value: 'retail_shop', label: 'Retail Shop / Ground Space (የንግድ ሱቅ)' },
  { value: 'whole_floor', label: 'Whole Floor Lease (ሙሉ ፎቅ)' },
  { value: 'coworking_desk', label: 'Coworking / Desk Space (የጋራ ቢሮ)' },
  { value: 'residential_unit', label: 'Residential Unit (የመኖሪያ አፓርታማ)' },
]

const SAMPLE_ROOM_PHOTOS = [
  { label: 'Modern Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80' },
  { label: 'Executive Suite', url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80' },
  { label: 'Retail Shop', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80' },
  { label: 'Open Workspace', url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80' },
  { label: 'Clinic / Medical Room', url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80' },
]

export default function BuildingFloorManager({
  initialDetails,
  onChange,
  baseRent = 18000,
}: BuildingFloorManagerProps) {
  const compId = useId()

  const [rentalScope, setRentalScope] = useState<'flexible' | 'individual_rooms' | 'by_floor' | 'entire_building'>(
    initialDetails?.rentalScope || 'flexible'
  )
  const [totalFloors, setTotalFloors] = useState<number>(initialDetails?.totalFloors || 3)
  const [hasGroundFloor, setHasGroundFloor] = useState<boolean>(true)
  const [activeFloorTab, setActiveFloorTab] = useState<number>(1)
  const [quickRoomCountInput, setQuickRoomCountInput] = useState<string>('3')
  const [editingPhotoRoomId, setEditingPhotoRoomId] = useState<string | null>(null)

  const [units, setUnits] = useState<BuildingUnit[]>(
    initialDetails?.units && initialDetails.units.length > 0
      ? initialDetails.units
      : [
          {
            id: 'room-101',
            unitNumber: 'Office 101',
            name: 'Office Suite 101',
            spaceType: 'office_room',
            floorNumber: 1,
            sizeM2: 35,
            monthlyRent: 18000,
            depositAmount: 36000,
            image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
            suitableFor: ['Office', 'Consultant'],
            status: 'available',
          },
          {
            id: 'room-102',
            unitNumber: 'Office 102',
            name: 'Office Suite 102',
            spaceType: 'office_room',
            floorNumber: 1,
            sizeM2: 40,
            monthlyRent: 20000,
            depositAmount: 40000,
            image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80',
            suitableFor: ['Tech / Startup', 'Legal'],
            status: 'available',
          },
          {
            id: 'shop-g1',
            unitNumber: 'Shop G-01',
            name: 'Ground Retail Shop G-01',
            spaceType: 'retail_shop',
            floorNumber: 0,
            sizeM2: 60,
            monthlyRent: 35000,
            depositAmount: 70000,
            image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
            suitableFor: ['Retail', 'Pharmacy', 'Boutique'],
            status: 'available',
          },
        ]
  )

  // Notify parent
  function emitChanges(
    newUnits: BuildingUnit[],
    newScope = rentalScope,
    newFloors = totalFloors
  ) {
    setUnits(newUnits)
    onChange({
      isMultiUnit: true,
      rentalScope: newScope,
      totalFloors: newFloors,
      totalUnits: newUnits.length,
      units: newUnits,
    })
  }

  // Floors list
  const floorList: number[] = []
  if (hasGroundFloor) floorList.push(0)
  for (let i = 1; i <= totalFloors; i++) {
    floorList.push(i)
  }

  function getFloorLabel(floor: number) {
    if (floor === 0) return 'Ground Floor'
    if (floor === 1) return '1st Floor'
    if (floor === 2) return '2nd Floor'
    if (floor === 3) return '3rd Floor'
    return `${floor}th Floor`
  }

  // Set exact number of rooms on a floor
  function handleSetRoomsForFloor(floor: number, countNum: number) {
    if (isNaN(countNum) || countNum <= 0) return
    const targetCount = Math.min(20, Math.max(1, countNum))

    // Other floor units
    const otherFloorUnits = units.filter((u) => u.floorNumber !== floor)
    const existingFloorUnits = units.filter((u) => u.floorNumber === floor)

    const updatedFloorUnits: BuildingUnit[] = []

    for (let i = 1; i <= targetCount; i++) {
      if (existingFloorUnits[i - 1]) {
        updatedFloorUnits.push(existingFloorUnits[i - 1])
      } else {
        const prefix = floor === 0 ? 'G-' : `${floor}0`
        const roomNum = floor === 0 ? `Shop ${prefix}${i}` : `Office ${prefix}${i}`
        const samplePhoto = floor === 0
          ? SAMPLE_ROOM_PHOTOS[2].url
          : SAMPLE_ROOM_PHOTOS[(i - 1) % SAMPLE_ROOM_PHOTOS.length].url

        updatedFloorUnits.push({
          id: `unit-${floor}-${Date.now()}-${i}`,
          unitNumber: roomNum,
          name: `${roomNum} (${getFloorLabel(floor)})`,
          spaceType: floor === 0 ? 'retail_shop' : 'office_room',
          floorNumber: floor,
          sizeM2: floor === 0 ? 55 : 35 + (i % 3) * 5,
          monthlyRent: floor === 0 ? 32000 : baseRent,
          depositAmount: (floor === 0 ? 32000 : baseRent) * 2,
          image: samplePhoto,
          suitableFor: floor === 0 ? ['Retail Store', 'Showroom'] : ['Office', 'Consultant'],
          status: 'available',
        })
      }
    }

    emitChanges([...otherFloorUnits, ...updatedFloorUnits])
  }

  // Add a single room
  function addRoomToFloor(floor: number) {
    const floorUnits = units.filter((u) => u.floorNumber === floor)
    const nextRoomIdx = floorUnits.length + 1
    const prefix = floor === 0 ? 'G-' : `${floor}0`
    const defaultNum = `${floor === 0 ? 'Shop ' : 'Office '}${prefix}${nextRoomIdx}`
    const defaultRent = floor === 0 ? 32000 : baseRent

    const newUnit: BuildingUnit = {
      id: `unit-${floor}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      unitNumber: defaultNum,
      name: `${defaultNum} (${getFloorLabel(floor)})`,
      spaceType: floor === 0 ? 'retail_shop' : 'office_room',
      floorNumber: floor,
      sizeM2: floor === 0 ? 50 : 35,
      monthlyRent: defaultRent,
      depositAmount: defaultRent * 2,
      image: floor === 0 ? SAMPLE_ROOM_PHOTOS[2].url : SAMPLE_ROOM_PHOTOS[0].url,
      suitableFor: floor === 0 ? ['Retail', 'Shop'] : ['Private Office', 'Consultant'],
      status: 'available',
    }

    emitChanges([...units, newUnit])
  }

  // Update room fields
  function updateUnitField<K extends keyof BuildingUnit>(index: number, field: K, value: BuildingUnit[K]) {
    const updated = [...units]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'monthlyRent' && typeof value === 'number') {
      updated[index].depositAmount = value * 2
    }
    emitChanges(updated)
  }

  // Remove room
  function removeUnit(index: number) {
    const updated = units.filter((_, i) => i !== index)
    emitChanges(updated)
  }

  // Clear all rooms on a floor
  function clearFloorRooms(floor: number) {
    const updated = units.filter((u) => u.floorNumber !== floor)
    emitChanges(updated)
  }

  const currentFloorUnits = units.filter((u) => u.floorNumber === activeFloorTab)
  const totalAvailable = units.filter((u) => u.status === 'available').length
  const totalProjectedRent = units.reduce((acc, u) => acc + (u.monthlyRent || 0), 0)

  return (
    <div className="rounded-2xl border border-charcoal/15 bg-white p-6 shadow-sm space-y-6">
      {/* ─── Header: Total Floors ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/10 pb-5">
        <div>
          <h3 className="font-display text-lg font-bold text-charcoal">
            Building Structure: Floors & Rooms
          </h3>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Configure how many floors the building has, then define the rooms on each level.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            {units.length} Rooms Configured
          </span>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-charcoal/80">
            {floorList.length} Floors
          </span>
        </div>
      </div>

      {/* ─── Step 1: Total Floors Stepper ─── */}
      <div className="rounded-xl border border-charcoal/15 bg-sand/30 p-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80 mb-2">
          Step 1: Number of Floors in Building
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-charcoal/20 p-1">
            <button
              type="button"
              disabled={totalFloors <= 1}
              onClick={() => {
                const next = Math.max(1, totalFloors - 1)
                setTotalFloors(next)
                if (activeFloorTab > next) setActiveFloorTab(next)
                emitChanges(units, rentalScope, next)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand text-lg font-bold text-charcoal hover:bg-sand-dark disabled:opacity-40 cursor-pointer"
            >
              -
            </button>

            <span className="min-w-28 text-center font-display text-base font-bold text-charcoal">
              {totalFloors} {totalFloors === 1 ? 'Floor' : 'Floors'}
            </span>

            <button
              type="button"
              disabled={totalFloors >= 30}
              onClick={() => {
                const next = Math.min(30, totalFloors + 1)
                setTotalFloors(next)
                emitChanges(units, rentalScope, next)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand text-lg font-bold text-charcoal hover:bg-sand-dark disabled:opacity-40 cursor-pointer"
            >
              +
            </button>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-semibold text-charcoal cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={hasGroundFloor}
              onChange={(e) => {
                setHasGroundFloor(e.target.checked)
                if (!e.target.checked && activeFloorTab === 0) setActiveFloorTab(1)
              }}
              className="h-4 w-4 rounded border-charcoal/30 text-rust focus:ring-rust"
            />
            <span>Include Ground Floor / Commercial Shops</span>
          </label>
        </div>
      </div>

      {/* ─── Step 2: Choose Floor to Manage ─── */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/80">
            Step 2: Select a floor to manage its rooms & photos
          </label>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Click any floor tab below to configure its rooms:
          </p>
        </div>

        {/* Floor Selection Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {floorList.map((floor) => {
            const count = units.filter((u) => u.floorNumber === floor).length
            const isTabActive = activeFloorTab === floor

            return (
              <button
                key={floor}
                type="button"
                onClick={() => setActiveFloorTab(floor)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                  isTabActive
                    ? 'bg-rust border-rust text-white shadow-sm'
                    : 'bg-white border-charcoal/15 text-charcoal hover:border-rust/40 hover:bg-sand/30'
                }`}
              >
                <span>{getFloorLabel(floor)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isTabActive ? 'bg-white/20 text-white' : 'bg-sand text-charcoal/70'
                  }`}
                >
                  {count} {count === 1 ? 'room' : 'rooms'}
                </span>
              </button>
            )
          })}
        </div>

        {/* ─── Floor Action Bar: Enter How Many Rooms On This Floor ─── */}
        <div className="rounded-xl border border-charcoal/15 bg-sand/20 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-bold text-charcoal">
                Configuring: {getFloorLabel(activeFloorTab)}
              </p>
              <p className="text-xs text-charcoal/60 mt-0.5">
                How many rooms or spaces are on this floor? Enter a number and click "Set Rooms".
              </p>
            </div>

            {/* Quick Room Count Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-charcoal whitespace-nowrap">
                Rooms on this floor:
              </span>
              <input
                type="number"
                min="1"
                max="20"
                value={quickRoomCountInput}
                onChange={(e) => setQuickRoomCountInput(e.target.value)}
                className="w-16 rounded-lg border border-charcoal/30 bg-white px-2.5 py-1.5 text-xs font-bold text-charcoal text-center focus:border-rust focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleSetRoomsForFloor(activeFloorTab, parseInt(quickRoomCountInput, 10))}
                className="rounded-lg bg-rust px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rust-dark transition-colors cursor-pointer"
              >
                Set Rooms
              </button>

              <button
                type="button"
                onClick={() => addRoomToFloor(activeFloorTab)}
                className="rounded-lg border border-rust bg-white px-3 py-1.5 text-xs font-bold text-rust hover:bg-rust hover:text-white transition-colors cursor-pointer"
              >
                + Add Room
              </button>
            </div>
          </div>
        </div>

        {/* ─── Room Cards with Photos on Selected Floor ─── */}
        {currentFloorUnits.length > 0 ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {units.map((unit, globalIdx) => {
                if (unit.floorNumber !== activeFloorTab) return null

                return (
                  <div
                    key={unit.id || globalIdx}
                    className="flex flex-col justify-between rounded-xl border border-charcoal/20 bg-white p-4 shadow-xs hover:border-rust/40 transition-colors"
                  >
                    <div>
                      {/* Room Photo & Upload */}
                      <div className="relative mb-3 h-36 w-full rounded-lg overflow-hidden bg-sand/50 border border-charcoal/10 group">
                        {unit.image ? (
                          <img
                            src={unit.image}
                            alt={unit.unitNumber}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-charcoal/40 text-xs">
                            <span>No photo attached</span>
                          </div>
                        )}

                        {/* Room Number Badge on Photo */}
                        <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">
                          {unit.unitNumber}
                        </div>

                        {/* Photo Action Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity p-2">
                          <button
                            type="button"
                            onClick={() => setEditingPhotoRoomId(unit.id || `unit-${globalIdx}`)}
                            className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-charcoal shadow-sm hover:bg-sand cursor-pointer"
                          >
                            Change Photo
                          </button>
                        </div>
                      </div>

                      {/* Photo Chooser Drawer */}
                      {editingPhotoRoomId === (unit.id || `unit-${globalIdx}`) && (
                        <div className="mb-3 rounded-lg border border-rust/30 bg-rust-tint/15 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-charcoal">
                              Attach Room Photo:
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingPhotoRoomId(null)}
                              className="text-xs text-charcoal/50 hover:text-charcoal cursor-pointer"
                            >
                              ✕ Close
                            </button>
                          </div>

                          {/* Quick Preset Photos */}
                          <div className="grid grid-cols-5 gap-1.5">
                            {SAMPLE_ROOM_PHOTOS.map((sp, spIdx) => (
                              <button
                                key={spIdx}
                                type="button"
                                onClick={() => {
                                  updateUnitField(globalIdx, 'image', sp.url)
                                  setEditingPhotoRoomId(null)
                                }}
                                className="relative rounded overflow-hidden aspect-video border border-charcoal/20 hover:border-rust cursor-pointer"
                                title={sp.label}
                              >
                                <img src={sp.url} alt={sp.label} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>

                          {/* Custom URL or Upload */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={unit.image || ''}
                              onChange={(e) => updateUnitField(globalIdx, 'image', e.target.value)}
                              placeholder="Or paste photo URL..."
                              className="flex-1 rounded border border-charcoal/20 bg-white px-2 py-1 text-[11px] focus:border-rust focus:outline-none"
                            />
                            <label className="rounded bg-sand px-2 py-1 text-[11px] font-semibold text-charcoal hover:bg-sand-dark cursor-pointer">
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    const preview = URL.createObjectURL(file)
                                    updateUnitField(globalIdx, 'image', preview)
                                    setEditingPhotoRoomId(null)
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Room Form Fields */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Unit Number */}
                        <div>
                          <label className="block text-[11px] font-semibold text-charcoal/70 mb-1">
                            Room / Suite #
                          </label>
                          <input
                            type="text"
                            value={unit.unitNumber}
                            onChange={(e) => updateUnitField(globalIdx, 'unitNumber', e.target.value)}
                            placeholder="e.g. Office 201"
                            className="w-full rounded-md border border-charcoal/20 px-2.5 py-1.5 text-xs font-bold text-charcoal focus:border-rust focus:outline-none"
                          />
                        </div>

                        {/* Space Type */}
                        <div>
                          <label className="block text-[11px] font-semibold text-charcoal/70 mb-1">
                            Space Type
                          </label>
                          <select
                            value={unit.spaceType}
                            onChange={(e) => updateUnitField(globalIdx, 'spaceType', e.target.value as any)}
                            className="w-full rounded-md border border-charcoal/20 px-2 py-1.5 text-xs text-charcoal focus:border-rust focus:outline-none"
                          >
                            {SPACE_TYPES.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Size m² */}
                        <div>
                          <label className="block text-[11px] font-semibold text-charcoal/70 mb-1">
                            Size (m²)
                          </label>
                          <input
                            type="number"
                            value={unit.sizeM2 || ''}
                            onChange={(e) => updateUnitField(globalIdx, 'sizeM2', Number(e.target.value) || 0)}
                            placeholder="e.g. 35"
                            className="w-full rounded-md border border-charcoal/20 px-2.5 py-1.5 text-xs text-charcoal focus:border-rust focus:outline-none"
                          />
                        </div>

                        {/* Monthly Rent */}
                        <div>
                          <label className="block text-[11px] font-semibold text-charcoal/70 mb-1">
                            Monthly Rent (ETB)
                          </label>
                          <input
                            type="number"
                            value={unit.monthlyRent || ''}
                            onChange={(e) => updateUnitField(globalIdx, 'monthlyRent', Number(e.target.value) || 0)}
                            placeholder="e.g. 18000"
                            step={500}
                            className="w-full rounded-md border border-rust/40 bg-rust-tint/10 px-2.5 py-1.5 text-xs font-bold text-rust focus:border-rust focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Room Footer: Status & Delete */}
                    <div className="flex items-center justify-between border-t border-charcoal/10 pt-3 mt-3">
                      <select
                        value={unit.status}
                        onChange={(e) => updateUnitField(globalIdx, 'status', e.target.value as any)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-bold ${
                          unit.status === 'available'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : unit.status === 'reserved'
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-gray-300 bg-gray-100 text-gray-700'
                        }`}
                      >
                        <option value="available">Available to Rent</option>
                        <option value="reserved">Reserved</option>
                        <option value="rented">Already Leased</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => removeUnit(globalIdx)}
                        className="text-xs text-charcoal/40 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Delete room"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Clear Floor Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => clearFloorRooms(activeFloorTab)}
                className="text-xs text-charcoal/50 hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear all rooms on {getFloorLabel(activeFloorTab)}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-charcoal/20 py-8 text-center bg-sand/30">
            <p className="text-sm font-bold text-charcoal">
              No rooms configured on {getFloorLabel(activeFloorTab)} yet
            </p>
            <p className="mt-1 text-xs text-charcoal/60 max-w-sm mx-auto">
              Enter the number of rooms above and click "Set Rooms" to automatically create the rooms on this floor.
            </p>
          </div>
        )}
      </div>

      {/* ─── Building Grand Summary ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-charcoal text-white p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sand">
            Commercial Building Setup
          </p>
          <p className="font-display text-base font-bold mt-0.5">
            {floorList.length} Floors • {units.length} Total Rooms ({totalAvailable} Vacant)
          </p>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-sand/80">Combined Monthly Potential</p>
          <p className="font-display text-lg font-bold text-rust-light">
            ETB {totalProjectedRent.toLocaleString()} <span className="text-xs font-normal text-white/70">/mo</span>
          </p>
        </div>
      </div>
    </div>
  )
}
