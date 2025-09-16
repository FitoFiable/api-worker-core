export type UserEvent = {
  title: string
  description: string
  category: 'email' | 'phone' | 'user' | 'payment' | 'system' | 'notification' | 'info' | 'warning' | 'success' | 'error'
  date: string
}

class EventLogBase {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()

    if (method === 'GET') {
      const limitParam = url.searchParams.get('limit')
      const cursorParam = url.searchParams.get('cursor')
      const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam))) : 20
      const cursor = cursorParam ? Math.max(0, parseInt(cursorParam)) : 0
      const events = (await this.state.storage.get<UserEvent[]>('events')) ?? []
      const total = events.length
      const toIndex = Math.max(0, total - cursor)
      const fromIndex = Math.max(0, toIndex - limit)
      const page = events.slice(fromIndex, toIndex)
      const nextCursor = fromIndex > 0 ? cursor + (toIndex - fromIndex) : null
      return new Response(JSON.stringify({ events: page, nextCursor, total }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => null) as Partial<UserEvent> | null
      if (!body || !body.title || !body.description || !body.category) {
        return new Response('Invalid body', { status: 400 })
      }
      const date = body.date ?? new Date().toISOString()
      const events = (await this.state.storage.get<UserEvent[]>('events')) ?? []
      events.push({ title: body.title, description: body.description, category: body.category as UserEvent['category'], date })
      // Keep only latest 1000 to bound storage
      const trimmed = events.slice(-1000)
      await this.state.storage.put('events', trimmed)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'DELETE') {
      await this.state.storage.delete('events')
      return new Response(null, { status: 204 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}

export class EventLogDevelopment extends EventLogBase {}
export class EventLogStaging extends EventLogBase {}
export class EventLogProduction extends EventLogBase {}


