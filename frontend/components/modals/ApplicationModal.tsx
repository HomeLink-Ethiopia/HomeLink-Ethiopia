'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUIStore } from '@/lib/store'
import { notify } from '@/lib/notifications'
import { useAuth, type User } from '@/lib/auth-context'
import ModalShell from './Modal'
import { Field, inputClass, SubmitButton, SuccessState } from './FormFields'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const schema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  phone: z.string().min(9, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email'),
  employmentStatus: z.enum(['employed', 'self_employed', 'student', 'other']),
  monthlyIncomeEtb: z.coerce.number().min(1, 'Enter your monthly income'),
  moveInDate: z.string().min(1, 'Choose a move-in date'),
  durationMonths: z.coerce.number().min(1).default(12),
  numberOfOccupants: z.coerce.number().min(1).default(1),
  religion: z.string().optional().default(''),
  maritalStatus: z.string().optional().default(''),
  smokingHabit: z.string().optional().default(''),
  alcoholHabit: z.string().optional().default(''),
  hasPets: z.string().optional().default(''),
  petDetails: z.string().optional(),
  quietHoursAgreed: z.boolean().default(true),
  previousLandlordName: z.string().optional(),
  previousLandlordPhone: z.string().optional(),
  previousRentalDuration: z.string().optional(),
  reasonForMoving: z.string().optional(),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function ApplicationModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'application'
  const { user, login, logout } = useAuth()

  const [submitted, setSubmitted] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Tenant supporting documents
  const [idFile, setIdFile] = useState<File | null>(null)
  const [incomeFile, setIncomeFile] = useState<File | null>(null)

  // Determine effective user and role from auth context or stored session
  const [storedUser, setStoredUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const curToken = typeof window !== 'undefined' ? localStorage.getItem('hl_token') : null
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('hl_user') : null
    setToken(curToken)
    if (rawUser) {
      try {
        setStoredUser(JSON.parse(rawUser))
      } catch {
        setStoredUser(null)
      }
    } else {
      setStoredUser(null)
    }
  }, [open, user])

  const effectiveUser = user || storedUser
  const isAuthenticated = !!token && !!effectiveUser
  const isTenant = isAuthenticated && effectiveUser?.role === 'tenant'
  const isOtherRole = isAuthenticated && !isTenant

  const returnPath = modalContext.propertyId ? `/property/${modalContext.propertyId}` : '/explore'

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employmentStatus: 'employed',
      durationMonths: 12,
      numberOfOccupants: 1,
      religion: '',
      maritalStatus: '',
      smokingHabit: '',
      alcoholHabit: '',
      hasPets: '',
      petDetails: '',
      quietHoursAgreed: true,
      previousLandlordName: '',
      previousLandlordPhone: '',
      previousRentalDuration: '',
      reasonForMoving: '',
      note: '',
    },
  })

  const currentHasPets = watch('hasPets')

  // Pre-fill form when open and authenticated as tenant
  useEffect(() => {
    if (!open) return
    if (isTenant && effectiveUser) {
      reset({
        fullName: effectiveUser.name || '',
        email: effectiveUser.email || '',
        phone: (effectiveUser as any).phone || '',
        employmentStatus: 'employed',
        monthlyIncomeEtb: (effectiveUser as any).monthlyIncome || undefined,
        moveInDate: '',
        durationMonths: 12,
        numberOfOccupants: 1,
        religion: (effectiveUser as any).religion || '',
        maritalStatus: (effectiveUser as any).maritalStatus || '',
        smokingHabit: (effectiveUser as any).smokingHabit || '',
        alcoholHabit: (effectiveUser as any).alcoholHabit || '',
        hasPets: (effectiveUser as any).hasPets === true ? 'has_pets' : ((effectiveUser as any).hasPets === false ? 'no_pets' : ''),
        petDetails: '',
        quietHoursAgreed: true,
        previousLandlordName: '',
        previousLandlordPhone: '',
        previousRentalDuration: '',
        reasonForMoving: '',
        note: '',
      })
    }
  }, [open, isTenant, effectiveUser, reset])

  // Duplicate-application check for logged-in tenants
  useEffect(() => {
    if (!open || !isTenant || !token || !modalContext.propertyId) {
      setAlreadyApplied(false)
      return
    }

    let active = true
    setChecking(true)
    fetch(`${API_URL}/api/v1/applications/my-applications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (!active) return
        const apps = Array.isArray(list) ? list : list.data || []
        setAlreadyApplied(
          apps.some(
            (a: any) =>
              String(a.propertyId?._id || a.propertyId) === String(modalContext.propertyId) &&
              !['withdrawn', 'rejected'].includes(a.status)
          )
        )
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
    }
  }, [open, isTenant, token, modalContext.propertyId])

  function handleClose() {
    closeModal()
    setTimeout(() => {
      setSubmitted(false)
      setSubmitError('')
      setIdFile(null)
      setIncomeFile(null)
      reset()
    }, 200)
  }

  async function onSubmit(values: FormValues) {
    setSubmitError('')
    try {
      const curToken = localStorage.getItem('hl_token')
      const formData = new FormData()
      formData.append('propertyId', modalContext.propertyId ?? '')
      formData.append('fullName', values.fullName)
      formData.append('phone', values.phone)
      formData.append('email', values.email)
      formData.append('employmentStatus', values.employmentStatus)
      formData.append('monthlyIncomeEtb', String(values.monthlyIncomeEtb))
      formData.append('monthlyIncome', String(values.monthlyIncomeEtb))
      formData.append('moveInDate', values.moveInDate)
      formData.append('durationMonths', String(values.durationMonths || 12))
      formData.append('numberOfOccupants', String(values.numberOfOccupants || 1))
      if (values.hasPets) {
        formData.append('hasPets', values.hasPets === 'has_pets' ? 'true' : 'false')
      }
      formData.append('petDetails', values.petDetails || '')
      if (values.religion) {
        formData.append('religion', values.religion)
      }
      if (values.maritalStatus) {
        formData.append('maritalStatus', values.maritalStatus)
      }
      if (values.smokingHabit) {
        formData.append('smokingHabit', values.smokingHabit)
      }
      if (values.alcoholHabit) {
        formData.append('alcoholHabit', values.alcoholHabit)
      }
      formData.append('quietHoursAgreed', String(values.quietHoursAgreed ?? true))
      formData.append('previousLandlordName', values.previousLandlordName || '')
      formData.append('previousLandlordPhone', values.previousLandlordPhone || '')
      formData.append('previousRentalDuration', values.previousRentalDuration || '')
      formData.append('reasonForMoving', values.reasonForMoving || '')
      formData.append('message', values.note || '')

      if (modalContext.selectedUnit) {
        formData.append('selectedUnit', JSON.stringify(modalContext.selectedUnit))
        formData.append('unitNumber', modalContext.selectedUnit.unitNumber)
      }

      if (idFile) {
        formData.append('documents', idFile)
        formData.append('documentTypes', 'kebele_id')
      }
      if (incomeFile) {
        formData.append('documents', incomeFile)
        formData.append('documentTypes', 'proof_of_income')
      }

      const res = await fetch(`${API_URL}/api/v1/applications`, {
        method: 'POST',
        headers: {
          ...(curToken ? { Authorization: `Bearer ${curToken}` } : {}),
        },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `Could not submit application (${res.status})`)
      }

      notify(
        'application_received',
        'Application submitted',
        `Your application for ${modalContext.propertyTitle || 'the property'} was sent to the landlord.`,
        '/tenant/applications'
      )
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Rental Application"
      subtitle={modalContext.propertyTitle ? `For ${modalContext.propertyTitle}` : undefined}
    >
      {submitted ? (
        <SuccessState
          title="Application submitted"
          body="Your rental application has been received by the landlord. You can track status and communicate directly in your Tenant Applications dashboard."
          onClose={handleClose}
        />
      ) : isOtherRole ? (
        /* Logged in with wrong role (Landlord or Admin) */
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-amber-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="mt-2 font-display text-lg font-bold text-charcoal">
              Tenant Account Required
            </h3>
            <p className="mt-1.5 text-sm text-charcoal/70 leading-relaxed">
              You are currently signed in as <strong>{effectiveUser?.name || 'Landlord'}</strong> ({effectiveUser?.role}). Rental
              applications can only be submitted by prospective tenants.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => logout(`/login?role=tenant&redirect=${encodeURIComponent(returnPath)}`)}
              className="w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-rust-dark active:scale-[0.98]"
            >
              Sign In with a Tenant Account
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg border border-charcoal/15 px-5 py-2 text-xs font-semibold text-charcoal/60 transition-colors hover:bg-sand"
            >
              Close
            </button>
          </div>
        </div>
      ) : !isAuthenticated ? (
        /* Not logged in at all */
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-rust">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal">Sign in to Apply</h3>
            <p className="mt-1.5 text-sm text-charcoal/70 leading-relaxed">
              Rental applications are submitted through a Tenant account. Please sign in or create an account to submit your application.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <a
              href={`/login?role=tenant&redirect=${encodeURIComponent(returnPath)}`}
              className="block w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-dark active:scale-[0.98]"
            >
              Sign In
            </a>
            <a
              href={`/signup?role=tenant&redirect=${encodeURIComponent(returnPath)}`}
              className="block w-full rounded-lg border-2 border-charcoal/15 px-5 py-2.5 text-sm font-bold text-charcoal transition-colors hover:border-rust hover:text-rust"
            >
              Create Account
            </a>
          </div>
        </div>
      ) : alreadyApplied ? (
        /* Tenant has already applied for this property */
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verified/10">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-verified">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-charcoal">You already applied</h3>
          <p className="text-sm text-charcoal/60">
            You have an active application for this property. The landlord will review it and respond through
            your Applications page — you don&apos;t need to apply twice.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <a
              href="/tenant/applications"
              className="w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-dark"
            >
              View my applications
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-lg border-2 border-charcoal/15 px-5 py-3 text-sm font-bold text-charcoal transition-colors hover:border-rust hover:text-rust"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        /* Valid Tenant application form */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tenant Identity Confirmation Chip */}
          <div className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-sand/30 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rust/10 font-bold text-rust">
                ✓
              </span>
              <div>
                <p className="font-semibold text-charcoal">
                  Applying as {effectiveUser?.name}
                </p>
                <p className="text-charcoal/60">{effectiveUser?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout(`/login?role=tenant&redirect=${encodeURIComponent(returnPath)}`)}
              className="text-[11px] font-semibold text-rust underline hover:text-rust-dark"
            >
              Switch account
            </button>
          </div>

          {/* Selected Building Unit / Workspace Badge */}
          {modalContext.selectedUnit && (
            <div className="rounded-lg border-2 border-rust bg-rust-tint/60 p-3 text-xs">
              <span className="block font-bold uppercase tracking-wider text-rust">
                Target Building Unit / Office Room
              </span>
              <span className="mt-0.5 block font-display text-sm font-bold text-charcoal">
                {modalContext.selectedUnit.name || modalContext.selectedUnit.unitNumber} • {modalContext.selectedUnit.sizeM2} m² (Floor {modalContext.selectedUnit.floorNumber})
              </span>
              <span className="mt-1 block text-charcoal/70">
                Monthly Rent: <strong className="text-rust">ETB {modalContext.selectedUnit.monthlyRent?.toLocaleString()}/mo</strong>
              </span>
            </div>
          )}

          <Field label="Full name" error={errors.fullName}>
            <input className={inputClass} placeholder="Your full name" {...register('fullName')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone}>
              <input className={inputClass} placeholder="09xx xxx xxx" {...register('phone')} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className={inputClass} placeholder="you@example.com" {...register('email')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Employment status" error={errors.employmentStatus}>
              <select className={inputClass} {...register('employmentStatus')}>
                <option value="employed">Employed</option>
                <option value="self_employed">Self-employed</option>
                <option value="student">Student</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Monthly income (ETB)" error={errors.monthlyIncomeEtb}>
              <input type="number" className={inputClass} placeholder="e.g. 25000" {...register('monthlyIncomeEtb')} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Preferred move-in date" error={errors.moveInDate}>
              <input type="date" className={inputClass} {...register('moveInDate')} />
            </Field>
            <Field label="Lease duration" error={errors.durationMonths}>
              <select className={inputClass} {...register('durationMonths')}>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (1 Year)</option>
                <option value={24}>24 Months (2 Years)</option>
              </select>
            </Field>
          </div>

          <Field label="Number of occupants" error={errors.numberOfOccupants}>
            <select className={inputClass} {...register('numberOfOccupants')}>
              <option value={1}>1 person (Just me)</option>
              <option value={2}>2 persons</option>
              <option value={3}>3 persons</option>
              <option value={4}>4+ persons</option>
            </select>
          </Field>

          {/* Ethiopian Household & Tenancy Criteria */}
          <div className="space-y-3.5 rounded-xl border border-charcoal/10 bg-cream/40 p-3.5">
            <div>
              <p className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                <span>🇪🇹</span> Ethiopian Landlord Fit & Household Profile
              </p>
              <p className="text-[10px] text-charcoal/60 mt-0.5">
                Landlords evaluate household background and living habits to protect their home and ensure community compatibility.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Religion / Faith (Optional)" error={errors.religion}>
                <select className={inputClass} {...register('religion')}>
                  <option value="">Prefer not to say / Undeclared</option>
                  <option value="Orthodox Christian">Orthodox Christian (የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ)</option>
                  <option value="Muslim">Muslim / Islam (እስልምና)</option>
                  <option value="Protestant">Protestant / Evangelical (ወንጌላዊ / ፔንጤ)</option>
                  <option value="Catholic">Catholic (ካቶሊክ)</option>
                  <option value="Other">Other / Non-denominational</option>
                </select>
              </Field>

              <Field label="Marital Status (Optional)" error={errors.maritalStatus}>
                <select className={inputClass} {...register('maritalStatus')}>
                  <option value="">Prefer not to say / Undeclared</option>
                  <option value="single">Single / Bachelor</option>
                  <option value="married">Married Couple</option>
                  <option value="family_with_kids">Family with Children</option>
                  <option value="roommates">Roommates / Shared</option>
                </select>
              </Field>
            </div>

            {/* Pets and Smoking declaration */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Do you have pets? (Optional)" error={errors.hasPets}>
                <select className={inputClass} {...register('hasPets')}>
                  <option value="">Prefer not to say / Undeclared</option>
                  <option value="no_pets">No pets (የቤት እንስሳ የለኝም)</option>
                  <option value="has_pets">Yes, I have pets (የቤት እንስሳ አለኝ)</option>
                </select>
              </Field>

              <Field label="Smoking Habit (Optional)" error={errors.smokingHabit}>
                <select className={inputClass} {...register('smokingHabit')}>
                  <option value="">Prefer not to say / Undeclared</option>
                  <option value="non_smoker">Non-smoker (ማያጨስ)</option>
                  <option value="balcony_only">Outdoor / Balcony only</option>
                  <option value="smoker">Smoker</option>
                </select>
              </Field>
            </div>

            {currentHasPets === 'has_pets' && (
              <Field label="Pet Details" error={errors.petDetails}>
                <input
                  className={inputClass}
                  placeholder="e.g. 1 vaccinated indoor cat, 1 small dog"
                  {...register('petDetails')}
                />
              </Field>
            )}

            {/* Binding Landlord House Rules & Property Standards Commitments */}
            <div className="rounded-lg border border-charcoal/15 bg-white p-3 space-y-2">
              <p className="text-[11px] font-bold text-charcoal flex items-center gap-1.5">
                <span>📋</span> Property Rules &amp; Standards Agreement
              </p>
              <div className="space-y-1.5 text-[11px] text-charcoal/80">
                <label className="flex items-start gap-2">
                  <span className="text-rust font-bold">✓</span>
                  <span><strong>100% Smoke-Free Property:</strong> Agree that indoor smoking is strictly prohibited.</span>
                </label>
                <label className="flex items-start gap-2">
                  <span className="text-rust font-bold">✓</span>
                  <span><strong>Quiet Hours &amp; Compound Harmony:</strong> Agree to observe quiet hours (10:00 PM – 7:00 AM) with zero disturbances or rowdy parties.</span>
                </label>
                <label className="flex items-start gap-2">
                  <span className="text-rust font-bold">✓</span>
                  <span><strong>Property Upkeep:</strong> Agree to maintain appliances, plumbing, and walls in clean condition.</span>
                </label>
              </div>
            </div>

            {/* Previous Landlord Reference & Rental History */}
            <div className="border-t border-charcoal/10 pt-3 space-y-2.5">
              <p className="text-[11px] font-bold text-charcoal">Previous Rental History & Landlord Reference</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Previous Landlord Name" error={errors.previousLandlordName}>
                  <input className={inputClass} placeholder="e.g. Ato Bekele Tadesse" {...register('previousLandlordName')} />
                </Field>
                <Field label="Previous Landlord Phone" error={errors.previousLandlordPhone}>
                  <input className={inputClass} placeholder="09xx xxx xxx" {...register('previousLandlordPhone')} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration at Previous Home" error={errors.previousRentalDuration}>
                  <input className={inputClass} placeholder="e.g. 2 years in CMC" {...register('previousRentalDuration')} />
                </Field>
                <Field label="Reason for Moving" error={errors.reasonForMoving}>
                  <input className={inputClass} placeholder="e.g. Closer to workplace" {...register('reasonForMoving')} />
                </Field>
              </div>
            </div>

            {/* House Rules Agreement */}
            <div className="border-t border-charcoal/10 pt-2.5">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  {...register('quietHoursAgreed')}
                  className="mt-0.5 rounded border-charcoal/20 text-rust focus:ring-rust"
                />
                <span className="text-[11px] text-charcoal/80 leading-tight">
                  I agree to respect property house rules: maintain quiet hours (10:00 PM – 7:00 AM), keep common areas clean, and preserve property condition.
                </span>
              </label>
            </div>
          </div>


          <Field label="Note to landlord (optional)" error={errors.note}>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Introduce yourself or mention any special preferences (e.g. move-in flexibility, parking needs)"
              {...register('note')}
            />
          </Field>

          {/* Supporting Documents (National ID & Proof of Income) */}
          <div className="space-y-3 rounded-xl border border-charcoal/10 bg-sand/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-charcoal">Supporting Documents</span>
              <span className="text-[10px] text-charcoal/50">Verified applications get priority</span>
            </div>

            {/* Kebele ID / Passport */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-charcoal">
                    Kebele ID / National ID / Passport <span className="text-rust">*</span>
                  </p>
                  <p className="text-[10px] text-charcoal/50">JPG, PNG, or PDF (max 10MB)</p>
                </div>
                {idFile ? (
                  <div className="flex items-center gap-2">
                    <span className="max-w-[120px] truncate text-xs font-mono font-medium text-charcoal">
                      {idFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIdFile(null)}
                      className="text-xs font-bold text-rust hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer rounded border border-charcoal/20 bg-cream/70 px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-sand/50 transition">
                    Upload ID
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setIdFile(e.target.files[0])
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Proof of Income / Employment Letter */}
            <div className="rounded-lg border border-charcoal/10 bg-white p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-charcoal">
                    Proof of Income / Employment Letter <span className="text-[10px] text-charcoal/40">(Optional)</span>
                  </p>
                  <p className="text-[10px] text-charcoal/50">Bank slip, payslip, or letter</p>
                </div>
                {incomeFile ? (
                  <div className="flex items-center gap-2">
                    <span className="max-w-[120px] truncate text-xs font-mono font-medium text-charcoal">
                      {incomeFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIncomeFile(null)}
                      className="text-xs font-bold text-rust hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer rounded border border-charcoal/20 bg-cream/70 px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-sand/50 transition">
                    Upload File
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setIncomeFile(e.target.files[0])
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {submitError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <SubmitButton pending={isSubmitting || checking}>
            {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
          </SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
