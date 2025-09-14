import { Hono } from 'hono'
import { Bindings } from './bindings.js'
import { GoogleGenAI } from "@google/genai";
import { cors } from 'hono/cors'
import { generateAllowedOrigins } from './middleware/cors.js'
import { oidcAuthMiddleware, getAuth, revokeSession, processOAuthCallback , getAuthorizationServer} from '@hono/oidc-auth'


export type Variables = {
  gemini: GoogleGenAI
}

export type honoContext = { Bindings: Bindings, Variables: Variables }

const app = new Hono<honoContext>()



// CORS for UI dev server and production
app.use('*', cors({
  origin: (origin, c) => {
    const frontendOrigin = c.env.FRONTEND_ORIGIN
    if (!frontendOrigin) {
      throw new Error('FRONTEND_ORIGIN environment variable is not set')
    }
    const allowedOrigins = generateAllowedOrigins(frontendOrigin)
    if (!origin) return allowedOrigins[0]
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  },
  credentials: true,
  allowMethods: ['GET','POST','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type']
}))

// logout es donde se redirige al usuario al deslogeo de Cognito
app.get('/logout', async (c) => {
  await revokeSession(c)
  const logoutUrl = `${c.env.COGNITO_HOSTED_UI_URL}/logout?client_id=${c.env.OIDC_CLIENT_ID}&logout_uri=${c.env.API_URL}/signout`;
  return c.redirect(logoutUrl);
})
// signout es donde Cognito redirige al usuario cuando se desloguea
app.get('/signout', async (c) => {
  const redirectTo = c.req.query('redirect_to')
  if (redirectTo) {
    return c.redirect(redirectTo)
  }
  else {
    return c.redirect(c.env.FRONTEND_ORIGIN)
  }
})
// callback es donde está toda la lógica de OAuth
app.get('/auth/callback', async (c) => {
  return processOAuthCallback(c)
})




// app.use('/protected/*', oidcAuthMiddleware())

// Ejemplo de ruta protegida
app.get("/protected/user", async (c) => {
  console.log('protected/user')
  const auth = await getAuth(c)
  console.log('auth', auth)
  if (!auth) {
    return c.json({
      authUrl: c.env.API_URL + "/login",
      status: "UNAUTHENTICATED"
    }, 401)
  }
  console.log('auth', auth)
  return c.json( { userID: auth?.sub}, 200)
})

// login es donde se redirige al usuario al login de Cognito
app.use('/login-get-redirect-url', oidcAuthMiddleware())
app.get('/login-get-redirect-url', async (c) => {
  const auth = await getAuth(c)
  console.log('auth', auth)
  return c.json({ authUrl: auth?.authUrl }, 200)
})

app.get("/login", async (c) => {
  const auth = await getAuth(c)
  console.log('auth', auth)
  if (!auth) {

    const response = await fetch(c.env.API_URL + "/login-get-redirect-url");
    const loginUrl = response.url;
    console.log('loginUrl', loginUrl);
    console.log('c.req.query("lang")', c.req.query('lang'));
    if (c.req.query('lang')) {
      return c.redirect(loginUrl + "&lang=" + c.req.query('lang'));
    } else {
      return c.redirect(loginUrl);
    }

  }
  return c.redirect(c.env.FRONTEND_ORIGIN);
  
  // const redirectTo = c.req.query('redirect_to')
  // if (redirectTo) {
  //   return c.redirect(redirectTo)
  // }
  // else {
  //   return c.redirect(c.env.FRONTEND_ORIGIN)
  // }
})

app.get("/", async (c) => {
  return c.json({ message: "API funcionando correctamente" })
})


export default app

