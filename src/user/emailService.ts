import { Context } from "hono"


export class EmailService {
    constructor(private readonly c: Context) {}

    async getPhoneByEmail(email: string) {
        const id = this.c.env.EMAIL_DIRECTORY.idFromName(email)
        const stub = this.c.env.EMAIL_DIRECTORY.get(id)
        const res = await stub.fetch(`https://do/email-directory`)
        if (res.status === 404) return null
        if (!res.ok) throw new Error(`EmailDirectory DO error: ${res.status}`)
        const data = await res.json() as { email: string, phone: string }
        return data.phone
    }

    async assingPhoneToEmail(email: string, phone: string) {
        const id = this.c.env.EMAIL_DIRECTORY.idFromName(email)
        const stub = this.c.env.EMAIL_DIRECTORY.get(id)
        const res = await stub.fetch(`https://do/email-directory`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, phone })
        })
        if (!res.ok) throw new Error(`Failed to save email/phone in DO: ${res.status}`)
    }
}