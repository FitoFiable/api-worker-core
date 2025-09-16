export type EmailDirectoryRecord = {
  email: string
  phone: string
  updatedAt: number
}

export class EmailDirectory {
  state: DurableObjectState
  env: unknown

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()

    if (method === 'GET') {
      const record = await this.state.storage.get<EmailDirectoryRecord>('record')
      if (!record) {
        return new Response('Not Found', { status: 404 })
      }
      return new Response(JSON.stringify({ email: record.email, phone: record.phone, updatedAt: record.updatedAt }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (method === 'PUT' || method === 'POST') {
      const body = await request.json().catch(() => null) as Partial<EmailDirectoryRecord> | null
      if (!body || !body.email || !body.phone) {
        return new Response('Invalid body', { status: 400 })
      }
      const record: EmailDirectoryRecord = {
        email: body.email,
        phone: body.phone,
        updatedAt: Date.now()
      }
      await this.state.storage.put('record', record)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'DELETE') {
      await this.state.storage.delete('record')
      return new Response(null, { status: 204 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}

export class EmailDirectoryDevelopment extends EmailDirectory {}
export class EmailDirectoryStaging extends EmailDirectory {}
export class EmailDirectoryProduction extends EmailDirectory {}


