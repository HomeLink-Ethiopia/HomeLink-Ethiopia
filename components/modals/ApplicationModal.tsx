'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUIStore } from '@/lib/store'
import { submitApplication } from '@/services/api'
import ModalShell from './Modal'
import { Field, inputClass, SubmitButton, SuccessState } from './FormFields'

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
    await submitApplication({ propertyId: modalContext.propertyId ?? '', ...values })
    setSubmitted(true)
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
          <SubmitButton pending={isSubmitting}>Submit application</SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
