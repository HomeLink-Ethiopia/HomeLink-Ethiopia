'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import TopBar from '@/components/admin/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Participant {
  _id: string
  id?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: string
}

interface Conversation {
  _id: string
  participants: Participant[]
  lastMessage: string
  lastMessageAt: string
  propertyId?: { title?: string } | string
}

interface ChatMessage {
  _id: string
  senderId: Participant | string
  text?: string
  body?: string
  createdAt: string
  readAt?: string
}

export default function AdminMessagesPage() {
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentUserId = useRef('')

  const getToken = () => localStorage.getItem('hl_token') || ''

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const list = data.data || data.conversations || []
        setConversations(list)
        if (list.length > 0) {
          setActiveId(prev => prev || list[0]._id)
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    const user = localStorage.getItem('hl_user')
    if (user) {
      try { currentUserId.current = JSON.parse(user).id || JSON.parse(user)._id || '' } catch { /* ignore */ }
    }
  }, [])

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/messages/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.data || data.messages || [])
      }
    } catch { /* ignore */ }
    setLoadingMessages(false)
  }, [])

  useEffect(() => {
    if (activeId) fetchMessages(activeId)
  }, [activeId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const selectConversation = async (convId: string) => {
    setActiveId(convId)
    setMessages([])
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/v1/messages/${convId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch { /* ignore */ }
  }

  const sendMessage = async () => {
    if (!draft.trim() || !activeId || sending) return
    setSending(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: activeId, text: draft.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        const newMsg = data.data || data.message || data.messageObj
        if (newMsg) {
          setMessages(prev => [...prev, newMsg])
        }
        setDraft('')
        fetchConversations()
      }
    } catch { /* ignore */ }
    setSending(false)
  }

  const getParticipantsSummary = (conv: Conversation) => {
    const parts = conv.participants || []
    if (parts.length === 0) return 'Platform Thread'
    return parts.map(p => `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email || p.role || 'User').join(' ↔ ')
  }

  const getSenderName = (msg: ChatMessage) => {
    if (typeof msg.senderId === 'object' && msg.senderId) {
      const name = `${msg.senderId.firstName || ''} ${msg.senderId.lastName || ''}`.trim()
      const role = msg.senderId.role ? ` (${msg.senderId.role})` : ''
      return (name || msg.senderId.email || 'User') + role
    }
    return String(msg.senderId) === String(currentUserId.current) ? 'Admin (You)' : 'User'
  }

  const formatTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const activeConv = conversations.find(c => c._id === activeId)

  return (
    <>
      <TopBar title="Platform Communications & Messages" />
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto h-[calc(100vh-180px)] max-w-6xl overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-stamp">
          <div className="flex h-full">
            {/* Conversation list */}
            <div className="hidden w-80 shrink-0 flex-col border-r border-charcoal/10 sm:flex">
              <div className="border-b border-charcoal/10 px-4 py-3">
                <h2 className="font-display text-lg font-semibold text-charcoal">All Conversations</h2>
                <p className="text-xs text-charcoal/50">Platform-wide tenant & landlord messages</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4"><SkeletonList count={4} /></div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-charcoal/40">No conversations on the platform yet.</div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => selectConversation(c._id)}
                      className={`block w-full border-b border-charcoal/5 p-4 text-left transition-colors hover:bg-sand/30 ${
                        c._id === activeId ? 'bg-sand/60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-semibold text-charcoal">{getParticipantsSummary(c)}</p>
                        <span className="shrink-0 text-[10px] text-charcoal/40">{formatTime(c.lastMessageAt || new Date().toISOString())}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-charcoal/60">{c.lastMessage || 'No messages'}</p>
                      {c.propertyId && (
                        <span className="mt-1.5 inline-block rounded bg-charcoal/5 px-1.5 py-0.5 text-[10px] text-charcoal/60">
                          {typeof c.propertyId === 'object' ? c.propertyId.title : 'Property'}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat window */}
            <div className="flex flex-1 flex-col">
              {activeConv ? (
                <>
                  <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rust/10 text-sm font-semibold text-rust">
                        M
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-charcoal">{getParticipantsSummary(activeConv)}</p>
                        <p className="text-[11px] text-charcoal/50">
                          {typeof activeConv.propertyId === 'object' ? activeConv.propertyId.title : 'General Inquiry'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-verified/10 px-2.5 py-1 text-xs font-semibold text-verified">
                      Admin Oversight
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {loadingMessages ? (
                      <SkeletonList count={3} />
                    ) : (
                      <div className="space-y-3">
                        {messages.map((m) => {
                          const sId = typeof m.senderId === 'string' ? m.senderId : (m.senderId?._id || (m.senderId as any)?.id || '')
                          const isMe = String(sId) === String(currentUserId.current)
                          const content = m.text || (m as any).body || ''
                          return (
                            <div key={m._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isMe ? 'bg-rust text-white rounded-br-md' : 'bg-cream text-charcoal rounded-bl-md'
                              }`}>
                                <p className={`mb-1 text-[10px] font-semibold ${isMe ? 'text-white/80' : 'text-rust'}`}>
                                  {getSenderName(m)}
                                </p>
                                <p>{content}</p>
                                <p className={`mt-1 text-[10px] ${isMe ? 'text-white/60' : 'text-charcoal/40'}`}>
                                  {formatTime(m.createdAt)}
                                  {isMe && m.readAt ? ' • Read' : ''}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

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
                        placeholder="Reply as HomeLink Admin / Moderator..."
                        className="min-h-[40px] max-h-24 flex-1 resize-none rounded-xl border border-charcoal/10 bg-cream px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-rust focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={sendMessage}
                        disabled={!draft.trim() || sending}
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
                <EmptyState
                  icon="message"
                  title="Messages"
                  description="Select a conversation from the left to view messages and monitor communication."
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
