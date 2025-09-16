import { Context } from "hono"


export class EmailService {
    constructor(private readonly c: Context) {}

    async getPhoneByEmail(email: string) {
        const user = await this.c.env.FITOFIABLE_KV.get(`email-to-user/${email}`)
        if (!user) {
            return null
        }
        const userData = JSON.parse(user)
        if (!userData.email) {
            return null
        }
        return userData.email
    }

    async assingPhoneToEmail(email: string, phone: string) {
        await this.c.env.FITOFIABLE_KV.put(`email-to-user/${email}`, JSON.stringify({ email , phone }))
    }
}