'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'How does landlord and property verification work?',
    a: 'Landlords upload government-issued ID and property ownership documents (e.g. Title Deed or Lease Agreement). Our platform administrators review the documents before awarding the Verified badge.',
  },
  {
    q: 'How is the AI Fair-Rent Estimate calculated?',
    a: 'Our regression model estimates rental-price ranges based on location, square meters, bedrooms, amenities, and verified market comparables in Addis Ababa. It is labeled as an estimate, not an official appraisal.',
  },
  {
    q: 'What should I do if I suspect a fraudulent listing?',
    a: 'Click the "Report this listing" button on any property page or open the Fraud Reporting dialog. Our Trust & Safety team investigates flagged accounts immediately.',
  },
  {
    q: 'Can I pay my rent online via HomeLink Ethiopia?',
    a: 'Yes, our platform records monthly rent obligations, payment receipts, and balance ledgers, with support for local digital banking channels (e.g. Telebirr, CBE Birr).',
  },
]

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="bg-cream py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-rust">Help & Support</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-charcoal sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm text-charcoal/70">
            Find answers to common questions about verification, renting, payments, and platform security.
          </p>
        </div>

        {/* FAQS */}
        <div className="mt-12 space-y-4">
          {FAQS.map((faq, i) => (
            <div
              key={faq.q}
              className="rounded-xl border border-charcoal/10 bg-white p-5 shadow-sm transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between text-left font-display text-base font-semibold text-charcoal"
              >
                <span>{faq.q}</span>
                <span className="ml-4 font-mono text-lg text-rust">{openIndex === i ? '−' : '+'}</span>
              </button>
              {openIndex === i && (
                <p className="mt-3 text-sm text-charcoal/70 leading-relaxed border-t border-charcoal/5 pt-3">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* CONTACT FORM */}
        <div className="mt-16 rounded-2xl border border-charcoal/10 bg-white p-8 sm:p-10 shadow-stamp">
          <h2 className="font-display text-2xl font-bold text-charcoal">Still have questions?</h2>
          <p className="mt-1 text-sm text-charcoal/60">Send our support team a direct message.</p>

          {submitted ? (
            <div className="mt-6 rounded-lg bg-verified/10 p-4 text-center font-medium text-verified">
              Thank you! Your message has been received. Our team will contact you shortly.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSubmitted(true)
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal/60 mb-1">
                    Your Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Abebe Bikila"
                    className="w-full rounded-lg border border-charcoal/15 bg-cream px-3.5 py-2.5 text-sm text-charcoal focus:border-rust focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal/60 mb-1">
                    Phone / Email
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="+251 91 234 5678"
                    className="w-full rounded-lg border border-charcoal/15 bg-cream px-3.5 py-2.5 text-sm text-charcoal focus:border-rust focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal/60 mb-1">
                  How can we help?
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your inquiry or issue..."
                  className="w-full rounded-lg border border-charcoal/15 bg-cream px-3.5 py-2.5 text-sm text-charcoal focus:border-rust focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="notch bg-rust px-6 py-2.5 text-sm font-semibold text-white shadow-stamp hover:bg-rust-dark transition-colors"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
