'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUIStore } from '@/lib/store'
import { notify } from '@/lib/notifications'
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
  const [submitted, setSubmitted] = useState(false)
  // Login gate — re-checked whenever the modal opens (token can appear
  // after signup auto-login or a login in another tab).
  const [hasToken, setHasToken] = useState(true)
  useEffect(() => {
    if (open) setHasToken(!!localStorage.getItem('hl_token'))
  }, [open])

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
      reset()
    }, 200)
  }

  async function onSubmit(values: FormValues) {
    setSubmitError('')
    try {
    const token = localStorage.getItem('hl_token')
    // Team backend (Sprint 7) contract: requestedSlots[] + tenantNote.
    // A single chosen slot is wrapped in the requestedSlots array.
    const res = await fetch(`${API_URL}/api/v1/viewings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
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
          body="The landlord will confirm, reschedule, or cancel — you'll be notified either way."
          onClose={handleClose}
        />
      ) : !hasToken ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-amber-600">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-charcoal">Log in to schedule</h3>
          <p className="text-sm text-charcoal/60">
            Viewing requests are sent to the landlord through your account, so you can get the landlord's
            response as a notification. Log in or create a tenant account first.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <a
              href="/login"
              className="w-full rounded-lg bg-rust px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-dark"
            >
              Log in
            </a>
            <a
              href="/signup"
              className="w-full rounded-lg border-2 border-charcoal/15 px-5 py-3 text-sm font-bold text-charcoal transition-colors hover:border-rust hover:text-rust"
            >
              Create an account
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Preferred date" error={errors.preferredDate}>
            <input type="date" min={minDate} className={inputClass} {...register('preferredDate')} />
          </Field>

          <Field label="Preferred time" error={errors.preferredTime}>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setValue('preferredTime', slot, { shouldValidate: true })}
                  className={`rounded border px-3 py-2 text-sm font-medium transition-colors ${
                    selectedTime === slot
                      ? 'border-rust bg-rust-tint text-rust-dark'
                      : 'border-charcoal/15 text-charcoal hover:border-rust'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Note to landlord (optional)" error={errors.note}>
            <textarea rows={3} className={inputClass} placeholder="Anything to flag before the visit" {...register('note')} />
          </Field>

          {submitError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
          )}
          <SubmitButton pending={isSubmitting}>Request viewing</SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
