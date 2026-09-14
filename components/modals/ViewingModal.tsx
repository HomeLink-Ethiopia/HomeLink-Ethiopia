'use client'

import { useState } from 'react'
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
    const res = await fetch(`${API_URL}/api/v1/viewings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
      },
      body: JSON.stringify({
        propertyId: modalContext.propertyId ?? '',
        preferredDate: values.preferredDate,
        preferredTime: values.preferredTime,
        message: values.note || '',
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
