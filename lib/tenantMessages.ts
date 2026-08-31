import { personPhoto } from './images'

export interface ChatMessage {
  id: string
  from: 'me' | 'them'
  text: string
  time: string
}

export interface Conversation {
  id: string
  name: string
  role: string
  avatar: string
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

/** Mock data standing in for FR-09's secure messaging until the real service exists. */
export const TENANT_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    name: 'Samuel K.',
    role: 'Landlord',
    avatar: personPhoto('landlord-samuel-k'),
    lastMessage: 'Sure, I can have the plumber out Thursday morning.',
    lastTime: '10:42 AM',
    unread: 2,
    messages: [
      { id: 'm1', from: 'them', text: 'Hi Tsedi, got your maintenance request for the sink.', time: 'Yesterday' },
      { id: 'm2', from: 'me', text: 'Thanks! It has been dripping for about a week now.', time: 'Yesterday' },
      { id: 'm3', from: 'them', text: 'No problem, I will get someone out to look at it.', time: 'Yesterday' },
      { id: 'm4', from: 'them', text: 'Sure, I can have the plumber out Thursday morning.', time: '10:42 AM' },
    ],
  },
  {
    id: 'c2',
    name: 'HomeLink Support',
    role: 'Support',
    avatar: personPhoto('homelink-support'),
    lastMessage: 'Your payment for May has been confirmed.',
    lastTime: 'Apr 30',
    unread: 0,
    messages: [
      { id: 'm1', from: 'them', text: 'Your payment for May has been confirmed.', time: 'Apr 30' },
    ],
  },
]
