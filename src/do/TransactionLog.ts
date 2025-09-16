export type UserTransaction = {
  id?: string
  type?: 'expense' | 'income' | 'transfer'
  amount?: number
  description?: string
  category?: string
  date?: string
  time?: string
  location?: string
  mediaUrl?: string
  method?: 'card' | 'cash' | 'transfer' | 'whatsapp'
  status?: 'completed' | 'pending' | 'failed'
}

type ListResponse = { transactions: UserTransaction[], nextCursor: number | null, total: number }
type TransactionsConfig = { categories: string[], budgets: Record<string, number> }
const DEFAULT_CATEGORIES: string[] = [
  'Food', 'Leisure', 'Education', 'Other', 'Emergence'
]

class TransactionLogBase {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method.toUpperCase()
    const pathname = url.pathname

    // Config endpoints: GET/PUT https://do/transaction-log/config
    if (pathname.endsWith('/config')) {
      if (method === 'GET') {
        const current = (await this.state.storage.get<TransactionsConfig>('config')) ?? { categories: DEFAULT_CATEGORIES, budgets: {} }
        return new Response(JSON.stringify(current), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (method === 'PUT') {
        const body = await request.json().catch(() => null) as Partial<TransactionsConfig> | null
        if (!body) return new Response('Invalid body', { status: 400 })
        const prev = (await this.state.storage.get<TransactionsConfig>('config')) ?? { categories: DEFAULT_CATEGORIES, budgets: {} }
        const merged: TransactionsConfig = {
          categories: Array.isArray(body.categories) && body.categories.length ? Array.from(new Set(body.categories)) : prev.categories,
          budgets: typeof body.budgets === 'object' && body.budgets ? body.budgets as Record<string, number> : prev.budgets
        }
        await this.state.storage.put('config', merged)
        return new Response(JSON.stringify(merged), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('Method Not Allowed', { status: 405 })
    }

    // Transaction list
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

    // Update a transaction (e.g., category) via PATCH https://do/transaction-log?id=...
    if (method === 'PATCH') {
      const id = url.searchParams.get('id')
      if (!id) return new Response('Missing id', { status: 400 })
      const body = await request.json().catch(() => null) as Omit<Partial<UserTransaction>, 'id'> | null
      if (!body) return new Response('Invalid body', { status: 400 })
      const list = (await this.state.storage.get<UserTransaction[]>('transactions')) ?? []
      const idx = list.findIndex(t => t.id === id)
      if (idx === -1) return new Response('Not found', { status: 404 })
      // Don't allow changing id; also satisfy typing
      const updated: UserTransaction = { ...list[idx], ...body }
      list[idx] = updated
      await this.state.storage.put('transactions', list)
      return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } })
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


