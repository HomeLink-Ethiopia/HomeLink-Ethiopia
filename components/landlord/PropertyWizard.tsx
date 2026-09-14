'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { submitPropertyListing } from '@/services/api'
import { Field, inputClass, SubmitButton, SuccessState } from '@/components/modals/FormFields'

const AMENITY_OPTIONS = [
  'Wi-Fi',
  'Parking',
  'Water 24/7',
  'Security',
  'Kitchen',
  'Balcony',
  'Generator',
  'Elevator',
]

const schema = z.object({
  title: z.string().min(5, 'Give the listing a short, descriptive title'),
  neighborhood: z.enum(['Bole', 'Kazanchis', 'CMC', 'Saris', 'Yeka']),
  address: z.string().min(5, 'Enter the street address'),
  propertyType: z.enum(['apartment', 'house', 'studio', 'villa']),
  beds: z.coerce.number().min(0, 'Enter number of bedrooms'),
  baths: z.coerce.number().min(1, 'Enter number of bathrooms'),
  sizeSqm: z.coerce.number().min(10, 'Enter the size in m²'),
  description: z.string().min(20, 'Add at least a couple of sentences describing the unit'),
  priceEtb: z.coerce.number().min(1000, 'Enter the monthly rent in ETB'),
  depositEtb: z.coerce.number().min(0, 'Enter the deposit amount in ETB'),
  amenities: z.array(z.string()).default([]),
  photos: z
    .array(z.object({ url: z.string().url('Enter a valid image URL') }))
    .min(1, 'Add at least one photo link'),
  ownershipDocUrl: z.string().url('Add a link to your ownership document'),
  landlordIdDocUrl: z.string().url('Add a link to your government-issued ID'),
})

type FormValues = z.infer<typeof schema>

const STEPS = ['Property details', 'Pricing & amenities', 'Photos', 'Verification'] as const

const STEP_FIELDS: (keyof FormValues)[][] = [
  ['title', 'neighborhood', 'address', 'propertyType', 'beds', 'baths', 'sizeSqm', 'description'],
  ['priceEtb', 'depositEtb', 'amenities'],
  ['photos'],
  ['ownershipDocUrl', 'landlordIdDocUrl'],
]

export default function PropertyWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      neighborhood: 'Bole',
      propertyType: 'apartment',
      amenities: [],
      photos: [{ url: '' }],
    },
  })

  const { fields: photoFields, append: appendPhoto, remove: removePhoto } = useFieldArray({
    control,
    name: 'photos',
  })

  const amenities = watch('amenities')

  function toggleAmenity(name: string) {
    const next = amenities.includes(name) ? amenities.filter((a) => a !== name) : [...amenities, name]
    setValue('amenities', next, { shouldValidate: true })
  }

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function onSubmit(values: FormValues) {
    await submitPropertyListing({
      title: values.title,
      neighborhood: values.neighborhood,
      address: values.address,
      propertyType: values.propertyType,
      beds: values.beds,
      baths: values.baths,
      sizeSqm: values.sizeSqm,
      priceEtb: values.priceEtb,
      depositEtb: values.depositEtb,
      amenities: values.amenities,
      description: values.description,
      photoUrls: values.photos.map((p) => p.url),
      ownershipDocUrl: values.ownershipDocUrl,
      landlordIdDocUrl: values.landlordIdDocUrl,
    })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-stamp">
        <SuccessState
          title="Submitted for verification"
          body="Your property now appears in the admin Verification Queue. You'll be notified once it's reviewed, typically within 48 hours."
          onClose={() => router.push('/landlord/dashboard')}
        />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-6 shadow-stamp">
      {/* Step indicator */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors ${
                i <= step ? 'bg-rust text-white' : 'bg-sand text-charcoal/50'
              }`}
            >
              {i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:block ${i <= step ? 'text-charcoal' : 'text-charcoal/40'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-charcoal/10" />}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {step === 0 && (
              <>
                <Field label="Listing title" error={errors.title}>
                  <input className={inputClass} placeholder="2 Bedroom Apartment, Bole" {...register('title')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Neighborhood" error={errors.neighborhood}>
                    <select className={inputClass} {...register('neighborhood')}>
                      {['Bole', 'Kazanchis', 'CMC', 'Saris', 'Yeka'].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Property type" error={errors.propertyType}>
                    <select className={inputClass} {...register('propertyType')}>
                      <option value="apartment">Apartment</option>
                      <option value="house">House</option>
                      <option value="studio">Studio</option>
                      <option value="villa">Villa</option>
                    </select>
                  </Field>
                </div>
                <Field label="Street address" error={errors.address}>
                  <input className={inputClass} placeholder="Full address (kept private until an application is approved)" {...register('address')} />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Bedrooms" error={errors.beds}>
                    <input type="number" className={inputClass} {...register('beds')} />
                  </Field>
                  <Field label="Bathrooms" error={errors.baths}>
                    <input type="number" className={inputClass} {...register('baths')} />
                  </Field>
                  <Field label="Size (m²)" error={errors.sizeSqm}>
                    <input type="number" className={inputClass} {...register('sizeSqm')} />
                  </Field>
                </div>
                <Field label="Description" error={errors.description}>
                  <textarea rows={4} className={inputClass} placeholder="What makes this unit worth renting?" {...register('description')} />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Monthly rent (ETB)" error={errors.priceEtb}>
                    <input type="number" className={inputClass} placeholder="18000" {...register('priceEtb')} />
                  </Field>
                  <Field label="Deposit (ETB)" error={errors.depositEtb}>
                    <input type="number" className={inputClass} placeholder="36000" {...register('depositEtb')} />
                  </Field>
                </div>
                <Field label="Amenities">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {AMENITY_OPTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                          amenities.includes(a)
                            ? 'border-rust bg-rust-tint text-rust-dark'
                            : 'border-charcoal/15 text-charcoal hover:border-rust'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {step === 2 && (
              <Field label="Photo links" error={errors.photos?.[0]?.url ?? (errors.photos as any)}>
                <div className="space-y-2">
                  {photoFields.map((field, i) => (
                    <div key={field.id} className="flex gap-2">
                      <input
                        className={inputClass}
                        placeholder="https://…"
                        {...register(`photos.${i}.url` as const)}
                      />
                      {photoFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          aria-label="Remove photo"
                          className="shrink-0 rounded border border-charcoal/15 px-3 text-charcoal/50 hover:border-rust hover:text-rust"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => appendPhoto({ url: '' })}
                  className="mt-2 text-sm font-medium text-rust hover:text-rust-dark"
                >
                  + Add another photo
                </button>
                <p className="mt-2 text-xs text-charcoal/50">
                  At least 5 real photos recommended — stock or reused photos are flagged by the fraud-risk
                  model and slow down review.
                </p>
              </Field>
            )}

            {step === 3 && (
              <>
                <Field label="Ownership proof (link)" error={errors.ownershipDocUrl}>
                  <input className={inputClass} placeholder="Link to title deed or sublease agreement" {...register('ownershipDocUrl')} />
                </Field>
                <Field label="Landlord ID verification (link)" error={errors.landlordIdDocUrl}>
                  <input className={inputClass} placeholder="Link to government-issued ID" {...register('landlordIdDocUrl')} />
                </Field>
                <p className="text-xs text-charcoal/50">
                  Documents are only visible to HomeLink's verification team, never shown publicly.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex gap-3 border-t border-charcoal/10 pt-5">
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="flex-1 rounded border border-charcoal/15 px-5 py-2.5 text-sm font-medium text-charcoal hover:border-rust hover:text-rust"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 rounded bg-rust px-5 py-2.5 text-sm font-semibold text-white hover:bg-rust-dark"
            >
              Continue
            </button>
          ) : (
            <div className="flex-1">
              <SubmitButton pending={isSubmitting}>Submit for verification</SubmitButton>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
