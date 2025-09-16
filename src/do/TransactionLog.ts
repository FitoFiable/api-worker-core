export type UserTransaction = {
  id: string
  type: 'expense' | 'income' | 'transfer'
  amount: number
  description: string
  category: string
  date: string
  time: string
  location?: string
  mediaUrl?: string
  method: 'card' | 'cash' | 'transfer' | 'whatsapp'
  status: 'completed' | 'pending' | 'failed'
}

type ListResponse = { transactions: UserTransaction[], nextCursor: number | null, total: number }

class TransactionLogBase {
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
      const transactions = (await this.state.storage.get<UserTransaction[]>('transactions')) ?? []
      const total = transactions.length
      const toIndex = Math.max(0, total - cursor)
      const fromIndex = Math.max(0, toIndex - limit)
      const page = transactions.slice(fromIndex, toIndex)
      const nextCursor = fromIndex > 0 ? cursor + (toIndex - fromIndex) : null
      const body: ListResponse = { transactions: page, nextCursor, total }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => null) as { transaction?: UserTransaction, transactions?: UserTransaction[] } | null
      if (!body) {
        return new Response('Invalid body', { status: 400 })
      }
      const list = (await this.state.storage.get<UserTransaction[]>('transactions')) ?? []
      const toAdd: UserTransaction[] = []
      if (body.transaction) toAdd.push(body.transaction)
      if (Array.isArray(body.transactions)) toAdd.push(...body.transactions)
      if (!toAdd.length) return new Response('No transactions provided', { status: 400 })
      for (const t of toAdd) {
        // basic normalization
        if (!t.id) t.id = crypto.randomUUID()
        if (!t.date) t.date = new Date().toISOString().slice(0, 10)
        if (!t.time) t.time = new Date().toISOString().slice(11, 16)
      }
      list.push(...toAdd)
      const trimmed = list.slice(-2000)
      await this.state.storage.put('transactions', trimmed)
      return new Response(JSON.stringify({ ok: true, added: toAdd.length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (method === 'DELETE') {
      await this.state.storage.delete('transactions')
      return new Response(null, { status: 204 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}

export class TransactionLogDevelopment extends TransactionLogBase {}
export class TransactionLogStaging extends TransactionLogBase {}
export class TransactionLogProduction extends TransactionLogBase {}


