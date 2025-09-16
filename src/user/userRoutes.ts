import { Hono, Next } from 'hono'
import { getAuth } from '@hono/oidc-auth'
import { User } from './userMainService.js'
import { honoContext } from '../index.js'

import { SyncCodeService } from './syncCodeService.js'
import type { UserEvent } from '../do/EventLog.js'
import type { UserTransaction } from '../do/TransactionLog.js'

const userRoutes = new Hono<honoContext>()

// Middleware for authenticated users
userRoutes.use('*', async (c, next: Next) => {
  const auth = await getAuth(c)
  
  if (!auth) {
    return c.json({
      authUrl: c.env.API_URL + "/login",
      status: "UNAUTHENTICATED"
    }, 401)
  }
  
  // Inject User class into variables
  c.set('user', new User(c, auth.sub as string))
  
  await next()
})

// Get current user data
userRoutes.get('/', async (c) => {
  const user = c.get('user') as User
  
  try {
    const userData = await user.getUser()
    console.log('User data from KV:', userData)
    
    return c.json({ 
      userID: user.userId,
      userData: userData
    }, 200)
  } catch (error) {
    console.error('Error accessing user data:', error)
    return c.json({ 
      error: 'Failed to access user data',
      userID: user.userId
    }, 500)
  }
})

// Get user events
userRoutes.get('/events', async (c) => {
  const user = c.get('user') as User
  try {
    const id = c.env.EVENT_LOG.idFromName(user.userId)
    const stub = c.env.EVENT_LOG.get(id)
    const limit = c.req.query('limit') ?? '20'
    const cursor = c.req.query('cursor')
    const params = new URLSearchParams({ limit })
    if (cursor) params.set('cursor', cursor)
    const res = await stub.fetch(`https://do/event-log?${params.toString()}`)
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`)
    const body = await res.json() as { events: UserEvent[], nextCursor: number | null, total: number }
    return c.json(body, 200)
  } catch (error) {
    console.error('Error fetching events:', error)
    return c.json({ events: [], nextCursor: null, total: 0 }, 200)
  }
})

// Transactions
userRoutes.get('/transactions', async (c) => {
  const user = c.get('user') as User
  try {
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined
    const cursor = c.req.query('cursor') ? parseInt(c.req.query('cursor')!) : undefined
    const body = await user.getTransactions({ limit, cursor: cursor ?? null })
    return c.json(body, 200)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return c.json({ transactions: [], nextCursor: null, total: 0 }, 200)
  }
})

userRoutes.post('/transactions', async (c) => {
  const user = c.get('user') as User
  const payload = await c.req.json() as { transaction?: UserTransaction, transactions?: UserTransaction[] }
  try {
    const toAdd = payload.transactions ?? (payload.transaction ? [payload.transaction] : [])
    if (!toAdd.length) return c.json({ message: 'No transactions provided' }, 400)
    const res = await user.addTransactions(toAdd)
    return c.json({ message: 'Transactions added', ...res }, 200)
  } catch (error) {
    console.error('Error adding transactions:', error)
    return c.json({ message: 'Failed to add transactions' }, 500)
  }
})

// Set user name
userRoutes.post('/name', async (c) => {
  const user = c.get('user') as User
  const { name } = await c.req.json()
  await user.setUserName(name)
  return c.json({ message: 'User name set successfully' }, 200)
})

userRoutes.post('/phone', async (c) => {
  const user = c.get('user') as User
  const { phoneNumber } = await c.req.json()
  await user.setPhoneNumber(phoneNumber)
  return c.json({ message: 'Phone number set successfully' }, 200)
})

userRoutes.post('/syncCode/generate', async (c) => {
  const user = c.get('user') as User
  const code = await user.createSyncCode()
  return c.json({ message: 'Sync code generated successfully', code }, 200)
})


userRoutes.post('/syncCode/revoke', async (c) => {
  const user = c.get('user') as User
  await user.revokeSyncCode()
  return c.json({ message: 'Sync code revoked successfully' }, 200)
})
userRoutes.post('/language', async (c) => {
  const user = c.get('user') as User
  const { language } = await c.req.json()
  
  // Execute in background without awaiting
  c.executionCtx.waitUntil(user.setUserLanguage(language))
  
  return c.json({ message: 'Language set successfully' }, 200)
})

userRoutes.post('/allowedEmails', async (c) => {
  const user = c.get('user') as User
  const { allowedEmails } = await c.req.json()
  await user.setAllowedEmails(allowedEmails)
  return c.json({ message: 'Allowed emails set successfully' }, 200)
})

// Danger zone: delete all user data
userRoutes.delete('/delete', async (c) => {
  const user = c.get('user') as User
  try {
    await user.deleteAllUserData()
    return c.json({ message: 'All user data deleted' }, 200)
  } catch (error) {
    console.error('Error deleting all user data:', error)
    return c.json({ message: 'Failed to delete user data' }, 500)
  }
})






export default userRoutes
