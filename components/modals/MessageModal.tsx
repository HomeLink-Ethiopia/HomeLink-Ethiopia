'use client'

import { useState } from 'react'
import { useUIStore } from '@/lib/store'
import { notify } from '@/lib/notifications'
import ModalShell from './Modal'
import { Field, inputClass, SubmitButton, SuccessState } from './FormFields'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const schemaHint = 'Introduce yourself and say when you would like to move in.'

export default function MessageModal() {
  const { activeModal, modalContext, closeModal } = useUIStore()
  const open = activeModal === 'message'
  const [submitted, setSubmitted] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function handleClose() {
    closeModal()
    setTimeout(() => {
      setSubmitted(false)
      setText('')
      setError('')
    }, 200)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const token = localStorage.getItem('hl_token')
      const res = await fetch(`${API_URL}/api/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }),
        },
        body: JSON.stringify({
          receiverId: modalContext.receiverId,
          propertyId: modalContext.propertyId || null,
          text: text.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || `Could not send the message (${res.status})`)
      }
      notify(
        'viewing_requested',
        'Message sent',
        `Your message to ${modalContext.receiverName || 'the landlord'} was delivered.`,
        '/tenant/messages'
      )
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const notLoggedIn = typeof window !== 'undefined' && !localStorage.getItem('hl_token')

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="Message Landlord"
      subtitle={modalContext.receiverName ? `To ${modalContext.receiverName}` : undefined}
    >
      {submitted ? (
        <SuccessState
          title="Message sent"
          body="The conversation now appears in your Messages page — the landlord will be notified."
          onClose={handleClose}
        />
      ) : notLoggedIn ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-amber-600">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v4a1 1 0 11-2 0V7zm1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-semibold text-charcoal">Log in to message</h3>
          <p className="text-sm text-charcoal/60">
            Messages go through your account so the landlord can reply and you get notified. Log in or create
            a tenant account first.
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
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Your message">
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={schemaHint}
              className={inputClass}
              required
            />
          </Field>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <SubmitButton pending={sending}>Send message</SubmitButton>
        </form>
      )}
    </ModalShell>
  )
}
