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

const TIME_SLOTS = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00']

const schema = z.object({
  preferredDate: z.string().min(1, 'Choose a date'),
  preferredTime: z.string().min(1, 'Choose a time'),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function ViewingModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'viewing'
  const { user, login, logout } = useAuth()

  const [submitted, setSubmitted] = useState(false)
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
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const selectedTime = watch('preferredTime')
  const minDate = new Date().toISOString().slice(0, 10)
  const [submitError, setSubmitError] = useState('')

  function handleClose() {
    closeModal()
    setTimeout(() => {
      setSubmitted(false)
      setSubmitError('')
      reset()
    }, 200)
  }

  async function onSubmit(values: FormValues) {
    setSubmitError('')
    try {
      const curToken = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/viewings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(curToken ? { Authorization: `Bearer ${curToken}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          propertyId: modalContext.propertyId ?? '',
          requestedSlots: [
            {
              date: new Date(`${values.preferredDate}T${values.preferredTime}:00`).toISOString(),
              startTime: values.preferredTime,
              endTime: values.preferredTime,
            },
          ],
          tenantNote: values.note || '',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `Could not submit viewing request (${res.status})`)
      }

      notify(
        'viewing_requested',
        'Viewing requested',
        `Your viewing request for ${modalContext.propertyTitle || 'the property'} was sent to the landlord.`,
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
      title="Schedule a Viewing"
      subtitle={modalContext.propertyTitle ? `For ${modalContext.propertyTitle}` : undefined}
    >
      {submitted ? (
        <SuccessState
          title="Viewing requested"
          body="The landlord will review your request and confirm visit instructions. You'll receive updates in your Tenant Dashboard."
          onClose={handleClose}
        />
      ) : isOtherRole ? (
        /* Logged in as landlord or admin */
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
              Property viewings can only be scheduled by prospective <strong>Tenants</strong>. Please sign in with
              a tenant account to schedule a tour.
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal">Sign in to Schedule a Tour</h3>
            <p className="mt-1.5 text-sm text-charcoal/70 leading-relaxed">
              Viewing requests are sent to the landlord through your <strong>Tenant</strong> account so you
              can receive confirmation notifications and appointment reminders.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <a
              href={`/login?role=tenant&redirect=${encodeURIComponent(returnPath)}`}
              className="block w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-dark active:scale-[0.98]"
            >
              Sign In
            </a>
            <button
              type="button"
              onClick={() => login('dev.tenant@homelink.test', 'Password123!')}
              className="w-full rounded-lg border border-charcoal/20 bg-sand/30 py-2 font-mono text-xs font-semibold text-charcoal transition-colors hover:border-rust hover:text-rust"
            >
              ⚡ Dev: Continue as Dev Tenant
            </button>
            <a
              href={`/signup?role=tenant&redirect=${encodeURIComponent(returnPath)}`}
              className="block w-full rounded-lg border-2 border-charcoal/15 px-5 py-2.5 text-sm font-bold text-charcoal transition-colors hover:border-rust hover:text-rust"
            >
              Create Account
            </a>
          </div>
        </div>
      ) : (
        /* Valid Tenant viewing request form */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-charcoal/10 bg-sand/30 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rust/10 font-bold text-rust">
                ✓
              </span>
              <div>
                <p className="font-semibold text-charcoal">
                  Requesting as {effectiveUser?.name}
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

          {modalContext.selectedUnit && (
            <div className="rounded-lg border-2 border-rust bg-rust-tint/60 p-3 text-xs">
              <span className="block font-bold uppercase tracking-wider text-rust">
                Viewing Specific Unit / Space
              </span>
              <span className="mt-0.5 block font-display text-sm font-bold text-charcoal">
                Unit {modalContext.selectedUnit.unitNumber} {modalContext.selectedUnit.floorNumber !== undefined ? `(Floor ${modalContext.selectedUnit.floorNumber})` : ''}
              </span>
            </div>
          )}

          <Field label="Preferred date" error={errors.preferredDate}>
            <input type="date" min={minDate} className={inputClass} {...register('preferredDate')} />
          </Field>

          <Field label="Preferred viewing time (select slot or adjust custom time)" error={errors.preferredTime}>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setValue('preferredTime', slot, { shouldValidate: true })}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    selectedTime === slot
                      ? 'border-rust bg-rust text-white shadow-sm'
                      : 'border-charcoal/20 bg-white text-charcoal hover:border-rust hover:text-rust'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>

            {/* Adjustable / Customizable Time Picker */}
            <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-charcoal/15 bg-sand/30 p-2.5">
              <span className="text-xs font-semibold text-charcoal whitespace-nowrap flex items-center gap-1">
                <span>⏱️</span> Custom Time:
              </span>
              <input
                type="time"
                value={selectedTime || ''}
                onChange={(e) => setValue('preferredTime', e.target.value, { shouldValidate: true })}
                className="w-full rounded-md border border-charcoal/20 bg-white px-3 py-1.5 text-sm font-medium text-charcoal outline-none focus:border-rust"
              />
              {selectedTime && (
                <span className="rounded bg-rust/10 px-2 py-0.5 text-[11px] font-bold text-rust whitespace-nowrap">
                  {selectedTime}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-charcoal/50">
              Pick a quick suggested hour or enter any custom morning/afternoon time.
            </p>
          </Field>

          <Field label="Note for landlord (optional)" error={errors.note}>
            <textarea
              rows={3}
              className={inputClass}
              placeholder="Any questions about the home or specific times you are available"
              {...register('note')}
            />
          </Field>

          {submitError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {submitError}
            </p>
          )}

          <SubmitButton pending={isSubmitting}>
            {isSubmitting ? 'Requesting Viewing...' : 'Request Viewing Tour'}
          </SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
