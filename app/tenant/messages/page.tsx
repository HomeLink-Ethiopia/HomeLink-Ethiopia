'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import TopBar from '@/components/tenant/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Participant {
  _id: string
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
  text: string
  createdAt: string
  readAt?: string
}

export default function MessagesPage() {
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
        setConversations(data.data || [])
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
        setMessages(data.data || [])
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
    // Mark as read
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/v1/messages/${convId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      // Update conversation list to remove unread
      setConversations(prev => prev.map(c => c._id === convId ? { ...c, lastMessage: c.lastMessage } : c))
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
        setMessages(prev => [...prev, data.data || data.message])
        setDraft('')
        // Refresh conversations to update lastMessage
        fetchConversations()
      }
    } catch { /* ignore */ }
    setSending(false)
  }

  const otherName = (conv: Conversation) => {
    const other = conv.participants?.find(p => p._id !== currentUserId.current)
    return other ? `${other.firstName || ''} ${other.lastName || ''}`.trim() || other.email : 'User'
  }

  const otherRole = (conv: Conversation) => {
    const other = conv.participants?.find(p => p._id !== currentUserId.current)
    return other?.role || ''
  }

  const senderName = (msg: ChatMessage) => {
    if (typeof msg.senderId === 'object') {
      return `${msg.senderId.firstName || ''} ${msg.senderId.lastName || ''}`.trim() || 'User'
    }
    return msg.senderId === currentUserId.current ? 'You' : 'User'
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
      <TopBar tenantName="Tenant" />
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto h-[calc(100vh-180px)] max-w-6xl overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-stamp">
          <div className="flex h-full">
            {/* Conversation list */}
            <div className="hidden w-80 shrink-0 flex-col border-r border-charcoal/10 sm:flex">
              <div className="border-b border-charcoal/10 px-4 py-3">
                <h2 className="font-display text-lg font-semibold text-charcoal">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4"><SkeletonList count={4} /></div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 text-center text-sm text-charcoal/40">No conversations yet.</div>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => selectConversation(c._id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        activeId === c._id ? 'bg-rust-tint/40' : 'hover:bg-sand/30'
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-charcoal">
                        {otherName(c)!.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-medium text-charcoal">{otherName(c)}</span>
                          <span className="shrink-0 text-[10px] text-charcoal/40">
                            {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}
                          </span>
                        </div>
                        <p className="truncate text-xs text-charcoal/50">
                          {c.lastMessage || 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat window */}
            <div className="flex flex-1 flex-col">
              {activeConv ? (
                <>
                  <div className="flex items-center gap-3 border-b border-charcoal/10 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-charcoal">
                      {otherName(activeConv)!.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{otherName(activeConv)}</p>
                      <p className="text-[11px] text-charcoal/50 capitalize">{otherRole(activeConv)}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4">
                    {loadingMessages ? (
                      <SkeletonList count={3} />
                    ) : (
                      <div className="space-y-3">
                        {messages.map((m) => {
                          const isMe = (typeof m.senderId === 'string' ? m.senderId : m.senderId?._id) === currentUserId.current
                          return (
                            <div key={m._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isMe ? 'bg-rust text-white rounded-br-md' : 'bg-cream text-charcoal rounded-bl-md'
                              }`}>
                                <p>{m.text}</p>
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
                        placeholder="Type a message..."
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
                  description="Select a conversation to start messaging."
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
