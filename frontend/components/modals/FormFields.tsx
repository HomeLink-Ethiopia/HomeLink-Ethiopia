import type { FieldError } from 'react-hook-form'

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: FieldError
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-charcoal">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-rust-dark">{error.message}</p>}
    </label>
  )
}

export const inputClass =
  'w-full rounded border border-charcoal/15 bg-white px-3 py-2.5 text-sm text-charcoal outline-none transition-colors focus:border-rust'

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-rust px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-rust-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 animate-spin" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
          <path d="M17.5 10a7.5 7.5 0 00-7.5-7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

export function SuccessState({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-verified/10 text-verified">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-charcoal">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-charcoal/60">{body}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 rounded border border-charcoal/15 px-5 py-2 text-sm font-medium text-charcoal hover:border-rust hover:text-rust"
      >
        Done
      </button>
    </div>
  )
}
