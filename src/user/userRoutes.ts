import { Hono, Next } from 'hono'
import { getAuth } from '@hono/oidc-auth'
import { User } from './user.js'
import { honoContext } from '../index.js'

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

// Set user name
userRoutes.post('/name', async (c) => {
  const user = c.get('user') as User
  const { name } = await c.req.json()
  await user.setUserName(name)
  return c.json({ message: 'User name set successfully' }, 200)
})



export default userRoutes
