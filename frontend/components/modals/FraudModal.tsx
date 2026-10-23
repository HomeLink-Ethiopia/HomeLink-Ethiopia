'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUIStore } from '@/lib/store'
import ModalShell from './Modal'
import { Field, inputClass, SubmitButton, SuccessState } from './FormFields'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

// Sprint 10 report types. The server maps these onto the FraudReport model
// enum (fake_property→fake_listing, fake_landlord→impersonation, etc.).
const schema = z.object({
  reason: z.enum(['fake_property', 'fake_landlord', 'scam', 'duplicate_listing', 'suspicious_payment', 'misleading_information', 'other']),
  details: z.string().min(15, 'Give a few more details so our team can investigate'),
  reporterEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

const RISK_STYLE: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-green-50 text-green-700 border-green-200',
}

export default function FraudModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'fraud'
  const [submitted, setSubmitted] = useState(false)
  const [riskLevel, setRiskLevel] = useState<string | null>(null)
  const [serverError, setServerError] = useState('')

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
      setRiskLevel(null)
      setServerError('')
      reset()
    }, 200)
  }

  // Files to the real endpoint (POST /api/v1/fraud-reports). The server's AI
  // risk engine scores the report (LOW/MEDIUM/HIGH) — it never auto-bans;
  // high-risk cases are queued for admin review only.
  async function onSubmit(values: FormValues) {
    setServerError('')
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('homelink-token') || ''
      const res = await fetch(`${API_URL}/api/v1/fraud-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          propertyId: modalContext.propertyId,
          category: values.reason,
          description: values.details,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not submit the report')
      setRiskLevel(data.riskLevel || null)
      setSubmitted(true)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not reach the server.')
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Report Suspicious Activity"
      subtitle={modalContext.propertyTitle ? `Regarding ${modalContext.propertyTitle}` : 'A listing, account, or message'}
    >
      {submitted ? (
        <>
          <SuccessState
            title="Report received"
            body="Our AI has assessed the risk and queued the case for administrator review. We never take automatic action against anyone based on a single report."
            onClose={handleClose}
          />
          {riskLevel && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs text-charcoal/60">AI Risk:</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${RISK_STYLE[riskLevel] || RISK_STYLE.LOW}`}>
                {riskLevel}
              </span>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}
          <Field label="What's the concern?" error={errors.reason}>
            <select className={inputClass} {...register('reason')}>
              <option value="fake_property">This property looks fake</option>
              <option value="fake_landlord">This landlord seems fake</option>
              <option value="scam">It&apos;s a scam</option>
              <option value="duplicate_listing">This listing appears elsewhere too</option>
              <option value="suspicious_payment">Asked to pay before viewing/signing</option>
              <option value="misleading_information">Information looks misleading</option>
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
