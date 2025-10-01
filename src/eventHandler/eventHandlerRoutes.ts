import { Hono, Next } from 'hono'
import { getAuth } from '@hono/oidc-auth'
import { honoContext } from '../index.js'
import {WabaSender} from './waba/wabaService.js'
import { Context } from 'hono'
import { SyncCodeService } from '../user/syncCodeService.js'
import { User } from '../user/userMainService.js'
import { PhoneService } from '../user/phoneService.js'
import { getLanguageByPhoneNumber } from './waba/getLanguageByPhoneNumber.js'
import { GoogleGenAI } from '@google/genai'
import type { UserTransaction } from '@/do/TransactionLog.js'

const eventHandlerRoutes = new Hono<honoContext>()

export type StandardizedMessageReceived = {
    messageId?: string; // Unique identifier for the message if available
    sender: string; // Sender of the message ejm. phone number
    receiver: string; // Receiver of the message ejm. phone number
    timestamp: string; // Timestamp of the message
    messageType: "text" | "audio" | "image" | "list_reply"; // Type of the message
    asociatedMessageId?: string; // MessageId of the message that this message is associated with (e.g. a reply to a message)
    associatedMediaUrl?: string; // URL of the media that this message is associated with (e.g. a reply to a message)
    content: string; // Content of the message - always a string for simplicity (audio and images are converted to a string)
  };
  



// Middleware for authenticated users
eventHandlerRoutes.use('*', async (c, next: Next) => {
  c.set('WabaSender', new WabaSender("", "en", c.env.WABA_WORKER_URL))
  c.set('SyncCodeService', new SyncCodeService(c))
  c.set('PhoneService', new PhoneService(c))
  await next()
})



eventHandlerRoutes.post('/standarizedInput', async (c) => {
  try {
    const messageReceived: StandardizedMessageReceived = await c.req.json()
    
    console.log('Received standardized message:', messageReceived)
    
    // Get WABA worker URL from environment
    const wabaWorkerUrl = c.env.WABA_WORKER_URL || 'http://localhost:8004'
    
    if (!messageReceived) {
      return c.json({ error: 'Missing standardizedMessage in request body' }, 400)
    }

    // Determine message type and call appropriate WABA endpoint
    let wabaResponse: any
    
    
    const sender = c.get('WabaSender')
    sender.setRecipient(messageReceived.sender)

    const fiveDigitMatch = messageReceived.content.match(/\b\d{5}\b/)
    const fiveDigitNumber = fiveDigitMatch ? parseInt(fiveDigitMatch[0]) : null
    
    const phoneService = c.get('PhoneService')
    const userID = await phoneService.getUserByPhoneNumber(messageReceived.sender)
    
    if (userID) {
      const user = new User(c, userID)
      const userData = await user.getUser()
      if (userData.phoneVerified) {
        if (userData.language) {
          sender.setLang(userData.language)
        }
        wabaResponse = await sender.sendHelloVerified({userData,replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})

        // Try to parse transactions from the incoming message using AI
        try {
          const genai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY })
          const system = `You are a transaction extractor. Given a user natural language message, extract zero or more transactions as strict JSON with the following TypeScript type:
type UserTransaction = { id: string; type: 'expense' | 'income' | 'transfer'; amount: number; description: string; category: string; date: string; time: string; location?: string; method: 'card' | 'cash' | 'transfer' | 'whatsapp'; status: 'completed' | 'pending' | 'failed' }.
Rules:
- currency is COP unless explicitly stated; numbers like 45k => 45000.
- If not explicit, infer 'status' as 'completed' and 'method' as 'whatsapp'.
- 'date' and 'time' default to now in the user's timezone (ISO: yyyy-mm-dd and HH:MM 24h).
- Keep 'description' concise; infer a simple 'category'.
- Always return JSON: { transactions: UserTransaction[] } and nothing else.`
          const input = messageReceived.content
          const now = new Date()
          const res = await genai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: `${system}\n\nNow: ${now.toISOString()}\nMessage: ${input}` }] }]
          })
          const text = res.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          let parsed: { transactions: UserTransaction[] } | null = null
          try {
            parsed = JSON.parse(text)
          } catch {
            // try to salvage JSON if model added code fences
            const match = text.match(/\{[\s\S]*\}/)
            if (match) {
              parsed = JSON.parse(match[0])
            }
          }
          // Fallback: if standardized message didn't include media URL, try to extract first URL from content
          const extractFirstUrl = (s: string): string | undefined => {
            const urlRegex = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/i
            const m = s.match(urlRegex)
            if (!m) return undefined
            const raw = m[0]
            return raw.startsWith('http') ? raw : `https://${raw}`
          }
          const mediaUrlFromMessage = messageReceived.associatedMediaUrl || extractFirstUrl(messageReceived.content)
          if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
            // normalize fields and sign conventions
            const userConfig = await user.getTransactionsConfig().catch(() => ({ categories: ['Food','Leisure','Education','Other','Emergence'], budgets: {} }))
            const allowedCats = new Set((userConfig.categories && userConfig.categories.length ? userConfig.categories : ['Food','Leisure','Education','Other','Emergence']).map(c => c.trim()))
            const normalized: UserTransaction[] = parsed.transactions.map(t => {
              const rawAmount = Number.isFinite(t.amount as number) ? Number(t.amount) : 0
              const inferredType = t.type ?? (rawAmount < 0 ? 'expense' : 'income')
              const absAmount = Math.abs(rawAmount)
              return {
                id: t.id || crypto.randomUUID(),
                type: inferredType,
                amount: inferredType === 'expense' ? -absAmount : absAmount,
                description: t.description ?? '',
                category: allowedCats.has((t.category || '').trim()) ? (t.category || '').trim() : 'Other',
                date: t.date ?? new Date().toISOString().slice(0,10),
                time: t.time ?? new Date().toISOString().slice(11,16),
                location: t.location,
                mediaUrl: mediaUrlFromMessage,
                method: (t.method ?? 'whatsapp'),
                status: (t.status ?? 'completed')
              }
            })
            await user.addTransactions(normalized)
            // send success confirmation via WABA with preview
            await sender.sendTransactionParsed({ 
              replyToMessageId: messageReceived.asociatedMessageId, 
              frontendUrl: c.env.FRONTEND_ORIGIN, 
              count: normalized.length,
              originalMessage: messageReceived.content,
              items: normalized.map(n => ({ type: String(n.type), amount: Number(n.amount), description: n.description ?? '' }))
            })
          } else {
            // send not-understood hint
            await sender.sendNotUnderstood({ replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN })
          }
        } catch (err) {
          console.error('AI parsing failed:', err)
          // failure: inform user
          try { await sender.sendNotUnderstood({ replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN }) } catch {}
        }
      } else {
        // Treat as unverified
        const language = getLanguageByPhoneNumber(messageReceived.sender)
        sender.setLang(language)

        if (fiveDigitNumber) {
          const validationResult = await c.get('SyncCodeService').validateSyncCode(fiveDigitNumber.toString(), messageReceived.sender)
          if (validationResult.isValid) {
            const user = new User(c, validationResult.userID!)
            const verified = await user.verifyPhone(validationResult)
            if (verified) {
              const userData = await user.getUser()
              // update sender language
              sender.setLang(userData.language ?? 'en')
              wabaResponse = await sender.sendVerifiedMessage({userData, replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
            }
          } else {
            wabaResponse = await sender.unableToVerifyPhone({replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
          }
        } else {
          wabaResponse = await sender.sendNoRegisteredMessage({replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
        }
      }
    } else {

      // if no user select language depending on the sender country code
       const language = getLanguageByPhoneNumber(messageReceived.sender)
       sender.setLang(language)

      if (fiveDigitNumber) {
        const validationResult = await c.get('SyncCodeService').validateSyncCode(fiveDigitNumber.toString(), messageReceived.sender)
        if (validationResult.isValid) {
          const user = new User(c, validationResult.userID!)
          const verified = await user.verifyPhone(validationResult)
          if (verified) {
            const userData = await user.getUser()
            // update sender language
            sender.setLang(userData.language ?? 'en')
            wabaResponse = await sender.sendVerifiedMessage({userData, replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
          }
        }else {
          wabaResponse = await sender.unableToVerifyPhone({replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
        }
      } else {
        wabaResponse = await sender.sendNoRegisteredMessage({replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
      }

    }

    return c.json({
      success: true,
      message: 'Message processed and sent via WABA worker',
      wabaResponse
    })
    
  } catch (error) {
    console.error('Error processing standardized message:', error)
    return c.json({ 
      error: 'Failed to process standardized message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default eventHandlerRoutes
