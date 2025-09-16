export class PhoneDirectoryBase {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()

    if (method === 'GET') {
      const record = await this.state.storage.get<{ userID: string }>('record')
      if (!record) return new Response('Not Found', { status: 404 })
      return new Response(JSON.stringify(record), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'PUT' || method === 'POST') {
      const body = await request.json().catch(() => null) as { userID?: string } | null
      if (!body || !body.userID) return new Response('Invalid body', { status: 400 })
      await this.state.storage.put('record', { userID: body.userID })
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'DELETE') {
      await this.state.storage.delete('record')
      return new Response(null, { status: 204 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}

export class PhoneDirectoryDevelopment extends PhoneDirectoryBase {}
export class PhoneDirectoryStaging extends PhoneDirectoryBase {}
export class PhoneDirectoryProduction extends PhoneDirectoryBase {}


