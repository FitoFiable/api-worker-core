import { Context } from "hono"


export class PhoneService {
    constructor(private readonly c: Context) {}

    async getUserByPhoneNumber(phoneNumber: string) {
        const id = this.c.env.PHONE_DIRECTORY.idFromName(phoneNumber)
        const stub = this.c.env.PHONE_DIRECTORY.get(id)
        const res = await stub.fetch('https://do/phone-directory')
        if (res.status === 404) return null
        if (!res.ok) throw new Error(`PhoneDirectory DO error: ${res.status}`)
        const data = await res.json() as { userID: string }
        return data.userID
    }

    async assingUserToPhoneNumber(phoneNumber: string, userID: string) {
        const id = this.c.env.PHONE_DIRECTORY.idFromName(phoneNumber)
        const stub = this.c.env.PHONE_DIRECTORY.get(id)
        const res = await stub.fetch('https://do/phone-directory', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID })
        })
        if (!res.ok) throw new Error(`Failed to save phone/user in DO: ${res.status}`)
    }

    async unassignPhoneNumber(phoneNumber: string) {
        const id = this.c.env.PHONE_DIRECTORY.idFromName(phoneNumber)
        const stub = this.c.env.PHONE_DIRECTORY.get(id)
        const res = await stub.fetch('https://do/phone-directory', {
            method: 'DELETE'
        })
        if (!res.ok && res.status !== 404) throw new Error(`Failed to delete phone mapping in DO: ${res.status}`)
    }
}