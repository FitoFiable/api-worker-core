import { Context, Hono, Next } from 'hono'
import { Bindings } from './bindings.js'
import { GoogleGenAI } from "@google/genai";
import { cors } from 'hono/cors'
import { generateAllowedOrigins } from './middleware/cors.js'
import { oidcAuthMiddleware, getAuth, revokeSession, processOAuthCallback , getAuthorizationServer} from '@hono/oidc-auth'
import media from './media/media.js'
import userRoutes from './user/userRoutes.js'
import { User } from './user/user.js'
export type Variables = {
  gemini: GoogleGenAI
  user: User
}

export type honoContext = { Bindings: Bindings, Variables: Variables }

const app = new Hono<honoContext>()



// CORS for UI dev server and production
app.use('*', cors({
  origin: (origin, c) => {
    const frontendOrigin = c.env.FRONTEND_ORIGIN
    const cognitoOrigin = c.env.COGNITO_HOSTED_UI_URL
    if (!frontendOrigin) {
      throw new Error('FRONTEND_ORIGIN environment variable is not set')
    }
    if (!cognitoOrigin) {
      throw new Error('COGNITO_HOSTED_UI_URL environment variable is not set')
    }
    const allowedOrigins = generateAllowedOrigins(frontendOrigin)
    allowedOrigins.push(cognitoOrigin)
    
    // Return the matching origin if it's allowed, otherwise return null
    if (!origin) return allowedOrigins[0]
    return allowedOrigins.includes(origin) ? origin : null
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS', "REDIRECT","PATCH"],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers']
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






const interceptRedirect = () => {
  return async (c: Context, next: Next) => {
    let lang = c.req.query('lang')
    if (!lang) {
      lang = 'en'
    }else{
      const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt']
      if (supportedLanguages.includes(lang)) {
        lang = lang.toLowerCase()
        if (lang == 'pt') {
          lang = 'pt-BR'
        }
      }else{
        lang = 'en'
      }
    }

    await next()

    console.log("interceptRedirect --------------------->")
    console.log('c.res', c.res)
    // Only care about redirect responses
    if (c.res.status >= 300 && c.res.status < 400) {
      const location = c.res.headers.get('Location')
      if (location) {
        const url = new URL(location, 'http://dummy-base') // base avoids errors on relative URLs
        url.searchParams.set('lang', lang)
        console.log("url.toString()", url.toString())
        return c.redirect(url.toString(), 302)
      }
    }
  }

}

app.use('/login', interceptRedirect())
app.use('/login', oidcAuthMiddleware())
app.get('/login', async (c) => {
  const redirectTo = c.req.query('redirect_to')
  if (redirectTo) {
    return c.redirect(redirectTo)
  }
  else {
    return c.redirect(c.env.FRONTEND_ORIGIN)
  }
})

app.get("/", async (c) => {
  return c.json({ message: "API funcionando correctamente" })
})







// Mount media router
app.route('/media', media)
app.route('/user', userRoutes)

export default app

