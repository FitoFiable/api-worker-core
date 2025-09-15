import { Hono, Next } from 'hono'
import { getAuth } from '@hono/oidc-auth'
import { honoContext } from '../index.js'

const eventHandlerRoutes = new Hono<honoContext>()

// Middleware for authenticated users
eventHandlerRoutes.use('*', async (c, next: Next) => {
  await next()
})

eventHandlerRoutes.post('/standarizedInput', async (c) => {
  const { message, receiverID } = await c.req.json()
})

export default eventHandlerRoutes
