import { Context } from "hono";
import { honoContext } from "@/index.js";



export class User {
    private readonly c: Context<honoContext>
    public readonly userId: string
    constructor(c: Context<honoContext>, userId: string) {
        this.c = c
        this.userId = userId
    }

    async getUser() {
        let user = await this.c.env.FITOFIABLE_KV.get(`user/${this.userId}`)
        
        if (!user) {
            // New user - create empty object in KV
            console.log('New user detected, creating empty user data')
            const emptyUserData = {}
            await this.c.env.FITOFIABLE_KV.put(`user/${this.userId}`, JSON.stringify(emptyUserData))
            return emptyUserData
        }
        
        return JSON.parse(user)
    }

    async setUserName(userName: string) {
        const user = await this.getUser()
        user.userName = userName
        await this.c.env.FITOFIABLE_KV.put(`user/${this.userId}`, JSON.stringify(user))
    }


}