import { Hono, Next } from 'hono'
import { getAuth } from '@hono/oidc-auth'
import { User } from './userMainService.js'
import { honoContext } from '../index.js'

import { SyncCodeService } from './syncCodeService.js'
import type { UserEvent } from '../do/EventLog.js'

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






export default userRoutes
