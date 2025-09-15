import { Context } from "hono";
import { honoContext } from "@/index.js";
import { SyncCodeService, SyncCodeValidationResult } from "./syncCodeService.js";
import { PhoneService } from "./phoneService.js";
import { WabaSender } from "@/eventHandler/waba/wabaService.js";

export class User {
    private readonly c: Context<honoContext>
    public readonly userId: string
    private readonly syncCodeService: SyncCodeService
    private readonly phoneService: PhoneService
    private  wabaSender: WabaSender | null = null
    constructor(c: Context<honoContext>, userId: string) {
        this.c = c
        this.userId = userId
        this.syncCodeService = new SyncCodeService(c)
        this.phoneService = new PhoneService(c)
        void this.initWabaSender()
    }

    async initWabaSender(): Promise<WabaSender | null> {
        const user = await this.getUser()

        if (user.phoneVerified) {
            if (user.language ) {
                this.wabaSender = new WabaSender(user.phoneNumber, user.language, this.c.env.WABA_WORKER_URL)
                return this.wabaSender
            }
            else {
                this.wabaSender = new WabaSender(user.phoneNumber, 'en', this.c.env.WABA_WORKER_URL)
                return this.wabaSender
            }
        }
        return null
    }

    async getUser() {
        console.log('Getting user data for user ID:', this.userId)
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

    async setUserLanguage(language: string) {
        const user = await this.getUser()
        user.language = language
        await this.c.env.FITOFIABLE_KV.put(`user/${this.userId}`, JSON.stringify(user))
        if (this.wabaSender) {
            this.wabaSender.setLang(language)
            this.wabaSender.sendLanguageChanged({userData: user, replyToMessageId: "", frontendUrl: this.c.env.FRONTEND_ORIGIN})
        }
        return null
    }

    async setPhoneNumber(phoneNumber: string) {
        const user = await this.getUser()
        user.phoneNumber = phoneNumber.replace('+', '') // Remove + from phone number
        user.lastSyncCode = undefined
        user.phoneVerified = false
        await this.c.env.FITOFIABLE_KV.put(`user/${this.userId}`, JSON.stringify(user))
    }

    async createSyncCode(): Promise<string> {
        const user = await this.getUser()
        if (user.phoneNumber) {
            if (user.lastSyncCode) {
                await this.revokeSyncCode()
            }
            user.lastSyncCode = await this.syncCodeService.generateSyncCode(this.userId, user.phoneNumber)
            return user.lastSyncCode
        } else {
            throw new Error('Phone number not set')
        }
    }

    async revokeSyncCode(): Promise<boolean> {
        const user = await this.getUser()
        if (user.phoneNumber) {
            if (user.lastSyncCode) {
                await this.syncCodeService.revokeSyncCode(user.lastSyncCode, user.phoneNumber)
                user.lastSyncCode = undefined
                await this.c.env.FITOFIABLE_KV.put(`user/${this.userId}`, JSON.stringify(user))
            }
            return true
        } else {
            throw new Error('Phone number not set or last sync code not found')
        }
    }

    async verifyPhone(validationResult: SyncCodeValidationResult): Promise<boolean> {
        console.log('Starting phone verification process')
        const user = await this.getUser()
        console.log('Retrieved user data:', user)
        
        if (user.phoneVerified) {
            console.log('Phone already verified')
            return true
        }

        if (user.phoneNumber) {
            console.log('Phone number exists, checking validation result')
            if (validationResult.isValid) {
                console.log('Validation successful, updating user data')
                user.phoneVerified = true
                await this.phoneService.assingUserToPhoneNumber(user.phoneNumber, this.userId)
                await this.c.env.FITOFIABLE_KV.put(`user/${this.userId}`, JSON.stringify(user))
                console.log('Phone verified, user data:', user)
                console.log('Revoking sync code')
                await this.revokeSyncCode()
                return true
            }
            else {
                console.log('Validation failed')
                return false
            }
        }
        console.log('No phone number found')
        return false
    }
}