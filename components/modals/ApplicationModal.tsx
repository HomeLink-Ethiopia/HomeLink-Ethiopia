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

const schema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  phone: z.string().min(9, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email'),
  employmentStatus: z.enum(['employed', 'self_employed', 'student', 'other']),
  monthlyIncomeEtb: z.coerce.number().min(1, 'Enter your monthly income'),
  moveInDate: z.string().min(1, 'Choose a move-in date'),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function ApplicationModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'application'
  const [submitted, setSubmitted] = useState(false)
  // Re-check the token every time the modal opens so a user who logs in
  // (in another tab or after auto-login from signup) isn't stuck on the gate.
  const [hasToken, setHasToken] = useState(true)
  // Duplicate-application guard: the backend rejects a second active
  // application for the same property — check upfront so the user sees a
  // friendly "already applied" state instead of filling the form in vain.
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    if (!open) return
    const token = localStorage.getItem('hl_token')
    setHasToken(!!token)
    setAlreadyApplied(false)
    if (!token || !modalContext.propertyId) return
    setChecking(true)
    fetch(`${API_URL}/api/v1/applications/my-applications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const apps = Array.isArray(list) ? list : list.data || []
        setAlreadyApplied(
          apps.some(
            (a: any) =>
              String((a.propertyId?._id || a.propertyId)) === String(modalContext.propertyId) &&
              !['withdrawn', 'rejected'].includes(a.status)
          )
        )
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [open, modalContext.propertyId])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

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
      const res = await fetch(`${API_URL}/api/v1/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          propertyId: modalContext.propertyId ?? '',
          fullName: values.fullName,
          phone: values.phone,
          email: values.email,
          employmentStatus: values.employmentStatus,
          monthlyIncomeEtb: values.monthlyIncomeEtb,
          moveInDate: values.moveInDate,
          message: values.note || '',
        }),
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
          body="The landlord will review your application and respond through your Applications tab."
          onClose={handleClose}
        />
      ) : !hasToken ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-amber-600">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-charcoal">Log in to apply</h3>
          <p className="text-sm text-charcoal/60">
            You need a tenant account before applying for a property. Log in or create one — it takes a minute,
            and your application will be tied to your account so the landlord can respond.
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
      ) : alreadyApplied ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verified/10">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-verified">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-charcoal">You already applied</h3>
          <p className="text-sm text-charcoal/60">
            You have an active application for this property. The landlord will review it and respond through
            your Applications page — you don't need to apply twice.
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <input type="number" className={inputClass} placeholder="20000" {...register('monthlyIncomeEtb')} />
            </Field>
          </div>
          <Field label="Preferred move-in date" error={errors.moveInDate}>
            <input type="date" className={inputClass} {...register('moveInDate')} />
          </Field>
          <Field label="Note to landlord (optional)" error={errors.note}>
            <textarea rows={3} className={inputClass} placeholder="Anything the landlord should know" {...register('note')} />
          </Field>
          {submitError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
          )}
          <SubmitButton pending={isSubmitting}>Submit application</SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
