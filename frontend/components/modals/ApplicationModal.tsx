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
  numberOfOccupants: z.coerce.number().min(1).default(1),
  emergencyContact: z.string().optional(),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function DocumentUploadBox({
  id,
  label,
  badge,
  badgeColor,
  description,
  files,
  onAddFiles,
  onRemoveFile,
  accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx',
  maxFiles = 3,
}: {
  id: string
  label: string
  badge: string
  badgeColor: string
  description: string
  files: File[]
  onAddFiles: (newFiles: File[]) => void
  onRemoveFile: (idx: number) => void
  accept?: string
  maxFiles?: number
}) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white p-3.5 shadow-sm transition-all hover:border-charcoal/20">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-charcoal">{label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
              {badge}
            </span>
          </div>
          <p className="text-[11px] text-charcoal/60 mt-0.5 leading-normal">{description}</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mb-2 space-y-1.5 pt-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs text-charcoal"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">📄</span>
                <span className="truncate font-medium max-w-[200px]">{file.name}</span>
                <span className="text-[10px] text-charcoal/45">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(idx)}
                className="text-red-500 hover:text-red-700 ml-2 font-bold px-1 rounded hover:bg-red-50"
                title="Remove document"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length < maxFiles && (
        <div>
          <input
            type="file"
            id={id}
            multiple={maxFiles > 1}
            accept={accept}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const incoming = Array.from(e.target.files)
                onAddFiles(incoming)
                e.target.value = ''
              }
            }}
            className="hidden"
          />
          <label
            htmlFor={id}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-charcoal/25 bg-sand/20 px-3 py-2 text-xs font-semibold text-charcoal hover:border-rust hover:bg-sand/40 hover:text-rust transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{files.length === 0 ? `Upload ${label}` : '+ Add another page / file'}</span>
          </label>
        </div>
      )}
    </div>
  )
}

export default function ApplicationModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'application'
  const [submitted, setSubmitted] = useState(false)
  const [hasToken, setHasToken] = useState(true)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [checking, setChecking] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      numberOfOccupants: 1,
      employmentStatus: 'employed',
    },
  })

  useEffect(() => {
    if (!open) return
    const token = localStorage.getItem('hl_token')
    setHasToken(!!token)
    setAlreadyApplied(false)

    // Prefill user details from localStorage if available
    try {
      const rawUser = localStorage.getItem('hl_user')
      if (rawUser) {
        const u = JSON.parse(rawUser)
        const name = (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.name) || ''
        if (name) setValue('fullName', name)
        if (u.email) setValue('email', u.email)
        if (u.phone) setValue('phone', u.phone)
      }
    } catch {}

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
  }, [open, modalContext.propertyId, setValue])

  // 4 Structured Real-Life Document Upload Slots
  const [idFiles, setIdFiles] = useState<File[]>([])
  const [incomeFiles, setIncomeFiles] = useState<File[]>([])
  const [bankFiles, setBankFiles] = useState<File[]>([])
  const [otherFiles, setOtherFiles] = useState<File[]>([])
  const [submitError, setSubmitError] = useState('')

  function handleClose() {
    closeModal()
    setTimeout(() => {
      setSubmitted(false)
      setIdFiles([])
      setIncomeFiles([])
      setBankFiles([])
      setOtherFiles([])
      reset()
    }, 200)
  }

  async function onSubmit(values: FormValues) {
    setSubmitError('')
    try {
      if (idFiles.length === 0) {
        setSubmitError('Please upload your Government Issued ID (Kebele ID, Fayda National ID, or Passport) to proceed.')
        return
      }

      const token = localStorage.getItem('hl_token')

      const allFilesWithCategory = [
        ...idFiles.map((file) => ({
          file,
          docType: 'government_id',
          category: 'Government ID (Kebele / Fayda / Passport)',
        })),
        ...incomeFiles.map((file) => ({
          file,
          docType: 'proof_of_income',
          category: 'Proof of Income / Employment',
        })),
        ...bankFiles.map((file) => ({
          file,
          docType: 'bank_statement',
          category: 'Bank Statement / Proof of Funds',
        })),
        ...otherFiles.map((file) => ({
          file,
          docType: 'additional_doc',
          category: 'Additional Supporting Document',
        })),
      ]

      const formData = new FormData()
      formData.append('propertyId', modalContext.propertyId ?? '')
      formData.append('fullName', values.fullName.trim())
      formData.append('phone', values.phone.trim())
      formData.append('email', values.email.trim())
      formData.append('employmentStatus', values.employmentStatus)
      formData.append('monthlyIncomeEtb', String(values.monthlyIncomeEtb))
      formData.append('monthlyIncome', String(values.monthlyIncomeEtb))
      formData.append('moveInDate', values.moveInDate)
      formData.append('numberOfOccupants', String(values.numberOfOccupants || 1))
      formData.append('emergencyContact', values.emergencyContact || '')
      formData.append('message', values.note || '')

      allFilesWithCategory.forEach(({ file, docType }, index) => {
        formData.append('documents', file)
        formData.append(`docType_${index}`, docType)
      })

      // Store in localStorage for instant realistic preview & alignment
      try {
        const docList = allFilesWithCategory.map(({ file, category, docType }) => ({
          name: file.name,
          type: category,
          docType,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          date: new Date().toLocaleDateString(),
        }))
        localStorage.setItem('hl_user_uploaded_docs', JSON.stringify(docList))
        localStorage.setItem(
          'hl_last_application_submitted',
          JSON.stringify({
            propertyId: modalContext.propertyId,
            propertyTitle: modalContext.propertyTitle,
            fullName: values.fullName.trim(),
            phone: values.phone.trim(),
            email: values.email.trim(),
            employmentStatus: values.employmentStatus,
            monthlyIncome: Number(values.monthlyIncomeEtb),
            numberOfOccupants: Number(values.numberOfOccupants || 1),
            emergencyContact: values.emergencyContact || '',
            note: values.note || '',
            submittedAt: new Date().toISOString(),
          })
        )
      } catch {}

      const res = await fetch(`${API_URL}/api/v1/applications`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Move-in date" error={errors.moveInDate}>
              <input type="date" className={inputClass} {...register('moveInDate')} />
            </Field>
            <Field label="Occupants" error={errors.numberOfOccupants}>
              <input type="number" min={1} max={10} className={inputClass} placeholder="1" {...register('numberOfOccupants')} />
            </Field>
          </div>

          <Field label="Emergency contact (optional)" error={errors.emergencyContact}>
            <input className={inputClass} placeholder="Name & phone (e.g. Brother • 0911...)" {...register('emergencyContact')} />
          </Field>

          {/* ── 4 STRUCTURED REAL-LIFE DOCUMENT UPLOAD SPACES ── */}
          <div className="space-y-3 pt-2 border-t border-charcoal/10">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">
                Required Documents & Verification
              </h4>
              <p className="text-[11px] text-charcoal/50">
                Landlords require these documents to screen applicants and prepare digital agreements.
              </p>
            </div>

            {/* 1. Government ID */}
            <DocumentUploadBox
              id="app-upload-gov-id"
              label="Government Issued ID"
              badge="Required"
              badgeColor="bg-rust/10 text-rust border border-rust/20"
              description="Upload clear photo or PDF of your Kebele ID Card (Front & Back), Fayda National ID, or Passport."
              files={idFiles}
              onAddFiles={(files) => setIdFiles((prev) => [...prev, ...files].slice(0, 3))}
              onRemoveFile={(idx) => setIdFiles((prev) => prev.filter((_, i) => i !== idx))}
            />

            {/* 2. Proof of Income */}
            <DocumentUploadBox
              id="app-upload-income"
              label="Proof of Employment / Income"
              badge="Recommended"
              badgeColor="bg-blue-50 text-blue-700 border border-blue-200"
              description="Employment verification letter, recent Pay slip, work contract, or official Work ID card."
              files={incomeFiles}
              onAddFiles={(files) => setIncomeFiles((prev) => [...prev, ...files].slice(0, 3))}
              onRemoveFile={(idx) => setIncomeFiles((prev) => prev.filter((_, i) => i !== idx))}
            />

            {/* 3. Bank Statement */}
            <DocumentUploadBox
              id="app-upload-bank"
              label="Bank Statement / Proof of Funds"
              badge="Optional"
              badgeColor="bg-sand/70 text-charcoal/70"
              description="Recent 3-month account statement from CBE, Awash, Dashen, Bank of Abyssinia, or Telebirr."
              files={bankFiles}
              onAddFiles={(files) => setBankFiles((prev) => [...prev, ...files].slice(0, 3))}
              onRemoveFile={(idx) => setBankFiles((prev) => prev.filter((_, i) => i !== idx))}
            />

            {/* 4. Additional Documents */}
            <DocumentUploadBox
              id="app-upload-other"
              label="Additional Supporting Documents"
              badge="Optional"
              badgeColor="bg-sand/70 text-charcoal/70"
              description="Guarantor agreement, Previous landlord recommendation letter, or family reference."
              files={otherFiles}
              onAddFiles={(files) => setOtherFiles((prev) => [...prev, ...files].slice(0, 3))}
              onRemoveFile={(idx) => setOtherFiles((prev) => prev.filter((_, i) => i !== idx))}
            />
          </div>

          <Field label="Note to landlord (optional)" error={errors.note}>
            <textarea rows={2} className={inputClass} placeholder="Anything the landlord should know" {...register('note')} />
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
