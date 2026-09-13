'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUIStore } from '@/lib/store'
import { submitFraudReport } from '@/services/api'
import ModalShell from './Modal'
import { Field, inputClass, SubmitButton, SuccessState } from './FormFields'

const schema = z.object({
  reason: z.enum(['duplicate_listing', 'fake_photos', 'unverified_landlord', 'payment_pressure', 'other']),
  details: z.string().min(15, 'Give a few more details so our team can investigate'),
  reporterEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export default function FraudModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'fraud'
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleClose() {
    closeModal()
    setTimeout(() => {
      setSubmitted(false)
      reset()
    }, 200)
  }

  async function onSubmit(values: FormValues) {
    await submitFraudReport({ propertyId: modalContext.propertyId, ...values })
    setSubmitted(true)
  }

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Report Suspicious Activity"
      subtitle={modalContext.propertyTitle ? `Regarding ${modalContext.propertyTitle}` : 'A listing, account, or message'}
    >
      {submitted ? (
        <SuccessState
          title="Report received"
          body="A high-priority case has been queued for administrator review. We won't take automatic action against anyone based on a single report."
          onClose={handleClose}
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="What's the concern?" error={errors.reason}>
            <select className={inputClass} {...register('reason')}>
              <option value="duplicate_listing">This listing appears elsewhere too</option>
              <option value="fake_photos">Photos look reused or fake</option>
              <option value="unverified_landlord">Landlord avoided verification</option>
              <option value="payment_pressure">Asked to pay before viewing/signing</option>
              <option value="other">Something else</option>
            </select>
          </Field>

          <Field label="Details" error={errors.details}>
            <textarea
              rows={4}
              className={inputClass}
              placeholder="What happened, and when?"
              {...register('details')}
            />
          </Field>

          <Field label="Your email (optional, for follow-up)" error={errors.reporterEmail}>
            <input className={inputClass} placeholder="you@example.com" {...register('reporterEmail')} />
          </Field>

          <SubmitButton pending={isSubmitting}>Submit report</SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
