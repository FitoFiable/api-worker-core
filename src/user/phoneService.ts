import { Context } from "hono"


export class PhoneService {
    constructor(private readonly c: Context) {}

    async getUserByPhoneNumber(phoneNumber: string) {
        const user = await this.c.env.FITOFIABLE_KV.get(`phone-to-user/${phoneNumber}`)
        if (!user) {
            return null
        }
        const userData = JSON.parse(user)
        if (!userData.userID) {
            return null
        }
        return userData.userID
    }

    async assingUserToPhoneNumber(phoneNumber: string, userID: string) {
        await this.c.env.FITOFIABLE_KV.put(`phone-to-user/${phoneNumber}`, JSON.stringify({ userID , test: 'test' }))
    }
}