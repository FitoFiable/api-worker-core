export class UserDirectoryBase {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const method = request.method.toUpperCase()

    if (method === 'GET') {
      const data = await this.state.storage.get<Record<string, unknown>>('record')
      if (!data) return new Response('Not Found', { status: 404 })
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'PUT' || method === 'POST') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      if (!body) return new Response('Invalid body', { status: 400 })
      await this.state.storage.put('record', body)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'DELETE') {
      await this.state.storage.delete('record')
      return new Response(null, { status: 204 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}

export class UserDirectoryDevelopment extends UserDirectoryBase {}
export class UserDirectoryStaging extends UserDirectoryBase {}
export class UserDirectoryProduction extends UserDirectoryBase {}


