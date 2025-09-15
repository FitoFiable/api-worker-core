import { Context } from "hono";
import { honoContext } from "@/index.js";
import { SyncCodeService } from "./syncCodeService.js";



export class User {
    private readonly c: Context<honoContext>
    public readonly userId: string
    private readonly syncCodeService: SyncCodeService

    constructor(c: Context<honoContext>, userId: string) {
        this.c = c
        this.userId = userId
        this.syncCodeService = new SyncCodeService(c)
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

    async getSyncCode(): Promise<string> {
        return await this.syncCodeService.generateSyncCode(this.userId)
    }

    async validateSyncCode(code: string) {
        return await this.syncCodeService.validateSyncCode(code)
    }

    async revokeSyncCode(code: string): Promise<boolean> {
        return await this.syncCodeService.revokeSyncCode(code)
    }


}