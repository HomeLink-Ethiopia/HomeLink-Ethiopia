'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import TopBar from '@/components/tenant/TopBar'
import { TENANT_CONVERSATIONS, type Conversation, type ChatMessage } from '@/lib/tenantMessages'

export default function MessagesPage() {
  const [conversations] = useState<Conversation[]>(TENANT_CONVERSATIONS)
  const [activeId, setActiveId] = useState<string>(TENANT_CONVERSATIONS[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const active = conversations.find((c) => c.id === activeId)

  const messages = active
    ? [...(active.messages || []), ...(localMessages[activeId] || [])]
    : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, activeId])

  function sendMessage() {
    if (!draft.trim() || !activeId) return
    const newMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      from: 'me',
      text: draft.trim(),
      time: 'Just now',
    }
    setLocalMessages((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), newMsg],
    }))
    setDraft('')
  }

  return (
    <>
      <TopBar tenantName="Tenant" />

      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto h-[calc(100vh-180px)] max-w-6xl overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-stamp">
          <div className="flex h-full">
            {/* ── Conversation list ── */}
            <div className="hidden w-80 shrink-0 flex-col border-r border-charcoal/10 sm:flex">
              <div className="border-b border-charcoal/10 px-4 py-3">
                <h2 className="font-display text-lg font-semibold text-charcoal">Messages</h2>
                <div className="relative mt-2">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40">
                    <path d="M9 3a6 6 0 100 12 6 6 0 000-12zM17 17l-3.5-3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search conversations…"
                    className="w-full rounded-lg border border-charcoal/10 bg-cream py-2 pl-9 pr-3 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      activeId === c.id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'
                    }`}
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
                      <Image src={c.avatar} alt={c.name} fill sizes="40px" className="object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-charcoal">{c.name}</span>
                        <span className="shrink-0 text-[10px] text-charcoal/40">{c.lastTime}</span>
                      </div>
                      <p className="truncate text-xs text-charcoal/50">{c.lastMessage}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rust text-[10px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Chat window ── */}
            <div className="flex flex-1 flex-col">
              {active ? (
                <>
                  {/* Chat header */}
                  <div className="flex items-center gap-3 border-b border-charcoal/10 px-4 py-3">
                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-sand">
                      <Image src={active.avatar} alt={active.name} fill sizes="36px" className="object-cover" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{active.name}</p>
                      <p className="text-[11px] text-charcoal/50">{active.role}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    <div className="space-y-3">
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              m.from === 'me'
                                ? 'bg-rust text-white rounded-br-md'
                                : 'bg-cream text-charcoal rounded-bl-md'
                            }`}
                          >
                            <p>{m.text}</p>
                            <p className={`mt-1 text-[10px] ${m.from === 'me' ? 'text-white/60' : 'text-charcoal/40'}`}>
                              {m.time}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Input */}
                  <div className="border-t border-charcoal/10 px-4 py-3">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        rows={1}
                        placeholder="Type a message…"
                        className="min-h-[40px] max-h-24 flex-1 resize-none rounded-xl border border-charcoal/10 bg-cream px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={sendMessage}
                        disabled={!draft.trim()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rust text-white transition-colors hover:bg-rust-dark disabled:opacity-40"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M2.5 2.5l15 7.5-15 7.5 2-7.5-2-7.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-charcoal/40">
                  Select a conversation to start messaging.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
