import { Bindings } from "../bindings.js"
import { Context } from "hono"
import { honoContext } from "../index.js"
import { googleForwardConfirmation } from "./email/google_foward_confirmation.js"
import { associatePhoneEmail } from "./email/associate_phone_email.js"
import { EmailService } from "../user/emailService.js"
import { PhoneService } from "../user/phoneService.js"
import { User } from "../user/userMainService.js"
import { WabaSender } from "../eventHandler/waba/wabaService.js"
import { GoogleGenAI } from "@google/genai"
import type { UserTransaction } from "@/do/TransactionLog.js"

export interface EmailData {
    envelope: {
      from: string
      to: string
      rawSize: number
    }
    smtpHeaders: {
      [key: string]: string
    }
    parsedHeaders: {
      [key: string]: string
    }
    subject: string
    from: string
    to: string
    date: string
    messageId: string
    body: string
  }
  

export const handleNewEmail = async (jsonEmail: EmailData, c: Context<honoContext>) => {
    const objectName = `${Date.now()}-${crypto.randomUUID()}.json`
    // Save to R2
    await c.env.FITOFIABLE_R2.put("email-received/" + objectName, JSON.stringify(jsonEmail, null, 2), {
        httpMetadata: { contentType: 'application/json' },
    })

    await googleForwardConfirmation(jsonEmail, c)
    await associatePhoneEmail(jsonEmail, c)

    // Attempt to find a user by associated email and process transactions
    try {
        const emailService = new EmailService(c)
        const fromEmail = jsonEmail.envelope.from || jsonEmail.from
        const phone = await emailService.getPhoneByEmail(fromEmail)
        if (!phone) return

        const phoneService = new PhoneService(c)
        const userID = await phoneService.getUserByPhoneNumber(phone)
        if (!userID) return

        const user = new User(c, userID)
        const userData = await user.getUser()
        if (!userData.phoneVerified || !userData.phoneNumber) return

        const lang = (userData.language || 'en')
        const sender = new WabaSender(userData.phoneNumber, lang, c.env.WABA_WORKER_URL)

        // Use AI to parse transactions from the email content
        const genai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY })
        const system = `You are a transaction extractor. Given an email text, extract zero or more transactions as strict JSON with the following TypeScript type:
type UserTransaction = { id: string; type: 'expense' | 'income' | 'transfer'; amount: number; description: string; category: string; date: string; time: string; location?: string; method: 'card' | 'cash' | 'transfer' | 'whatsapp'; status: 'completed' | 'pending' | 'failed' }.
Rules:
- currency is COP unless explicitly stated; numbers like 45k => 45000.
- If not explicit, infer 'status' as 'completed' and 'method' as 'whatsapp'.
- 'date' and 'time' default to now in the user's timezone (ISO: yyyy-mm-dd and HH:MM 24h).
- Keep 'description' concise; infer a simple 'category'.
- Always return JSON: { transactions: UserTransaction[] } and nothing else.`
        const input = `Subject: ${jsonEmail.subject}\nFrom: ${fromEmail}\n\n${jsonEmail.body}`
        const now = new Date()
        const res = await genai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `${system}\n\nNow: ${now.toISOString()}\nEmail:\n${input}` }] }]
        })
        const text = res.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        let parsed: { transactions: UserTransaction[] } | null = null
        try {
            parsed = JSON.parse(text)
        } catch {
            const match = text.match(/\{[\s\S]*\}/)
            if (match) parsed = JSON.parse(match[0])
        }

        if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
            const normalized: UserTransaction[] = parsed.transactions.map(t => ({
                id: t.id || crypto.randomUUID(),
                type: t.type ?? 'expense',
                amount: (t.type ?? 'expense') === 'expense' ? -Math.abs(t.amount ?? 0) : Math.abs(t.amount ?? 0),
                description: t.description ?? '',
                category: t.category ?? 'general',
                date: t.date ?? new Date().toISOString().slice(0, 10),
                time: t.time ?? new Date().toISOString().slice(11, 16),
                location: t.location,
                mediaUrl: undefined,
                method: t.method ?? 'whatsapp',
                status: t.status ?? 'completed'
            }))
            await user.addTransactions(normalized)
            await sender.sendTransactionParsed({ 
                frontendUrl: c.env.FRONTEND_ORIGIN, 
                count: normalized.length,
                originalMessage: jsonEmail.body,
                items: normalized.map(n => ({ type: n.type ?? 'expense', amount: n.amount ?? 0, description: n.description ?? '' }))
            })
        } else {
            await sender.sendNotUnderstood({ frontendUrl: c.env.FRONTEND_ORIGIN })
        }
    } catch (err) {
        console.error('Email transaction processing failed:', err)
    }

    return
}