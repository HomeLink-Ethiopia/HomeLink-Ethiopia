'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUIStore } from '@/lib/store'
import { submitMaintenanceRequest } from '@/services/api'
import ModalShell from './Modal'
import { Field, inputClass, SubmitButton, SuccessState } from './FormFields'

const PRIORITIES = [
  { value: 'low', label: 'Low', hint: 'Can wait a few weeks' },
  { value: 'medium', label: 'Medium', hint: 'Should be fixed this week' },
  { value: 'high', label: 'High', hint: 'Affecting daily use' },
  { value: 'urgent', label: 'Urgent', hint: 'Safety or habitability risk' },
] as const

const schema = z.object({
  category: z.enum(['plumbing', 'electrical', 'structural', 'appliance', 'pest', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  description: z.string().min(10, 'Describe the issue in a bit more detail'),
  mediaUrl: z.string().url('Enter a valid link').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export default function MaintenanceModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'maintenance'
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium' },
  })

  const selectedPriority = watch('priority')

  function handleClose() {
    closeModal()
    setTimeout(() => {
      setSubmitted(false)
      reset()
    }, 200)
  }

  async function onSubmit(values: FormValues) {
    await submitMaintenanceRequest({
      propertyId: modalContext.propertyId,
      category: values.category,
      priority: values.priority,
      description: values.description,
      mediaUrls: values.mediaUrl ? [values.mediaUrl] : [],
    })
    setSubmitted(true)
  }

  return (
    <ModalShell open={open} onClose={handleClose} title="Report a Maintenance Issue">
      {submitted ? (
        <SuccessState
          title="Request submitted"
          body="Your landlord has been notified. Track its status from Submitted through Resolved on your Maintenance page."
          onClose={handleClose}
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Category" error={errors.category}>
            <select className={inputClass} {...register('category')}>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="structural">Structural</option>
              <option value="appliance">Appliance</option>
              <option value="pest">Pest control</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Priority" error={errors.priority}>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setValue('priority', p.value, { shouldValidate: true })}
                  className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                    selectedPriority === p.value
                      ? 'border-rust bg-rust-tint'
                      : 'border-charcoal/15 hover:border-rust'
                  }`}
                >
                  <span className="font-medium text-charcoal">{p.label}</span>
                  <span className="block text-xs text-charcoal/50">{p.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Describe the issue" error={errors.description}>
            <textarea
              rows={4}
              className={inputClass}
              placeholder="What's wrong, and where in the unit?"
              {...register('description')}
            />
          </Field>

          <Field label="Photo or video link (optional)" error={errors.mediaUrl}>
            <input className={inputClass} placeholder="https://…" {...register('mediaUrl')} />
          </Field>

          <SubmitButton pending={isSubmitting}>Submit request</SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
