import { Bindings } from "../bindings.js"
import { Context } from "hono"
import { honoContext } from "../index.js"
import { googleForwardConfirmation } from "./email/google_foward_confirmation.js"
import { associatePhoneEmail } from "./email/associate_phone_email.js"

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

    return
}