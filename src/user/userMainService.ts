import { Context } from "hono";
import { honoContext } from "@/index.js";
import { SyncCodeService, SyncCodeValidationResult } from "./syncCodeService.js";
import { PhoneService } from "./phoneService.js";
import { WabaSender } from "@/eventHandler/waba/wabaService.js";
import type { userKV } from "./userKV.types.js";

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

        if (!user.phoneVerified || !user.phoneNumber) {
            return null
        }
        const language = user.language ? user.language : 'en'
        this.wabaSender = new WabaSender(user.phoneNumber, language, this.c.env.WABA_WORKER_URL)
        return this.wabaSender
    }

    async getUser() {
        console.log('Getting user data for user ID:', this.userId)
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        const res = await stub.fetch('https://do/user-directory')
        if (res.status === 404) {
            console.log('New user detected, creating empty user data')
            const emptyUserData: userKV = {}
            await stub.fetch('https://do/user-directory', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emptyUserData)
            })
            return emptyUserData
        }
        if (!res.ok) throw new Error(`UserDirectory DO error: ${res.status}`)
        return await res.json() as userKV
    }

    async setUserName(userName: string) {
        const user = await this.getUser()
        user.userName = userName
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
    }

    async setUserLanguage(language: string) {
        const user = await this.getUser()
        user.language = language
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
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
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
    }

    async createSyncCode(): Promise<string> {
        const user = await this.getUser()
        if (!user.phoneNumber) {
            throw new Error('Phone number not set')
        }

        // If there's an existing sync code, validate it first
        if (user.lastSyncCode) {
            const validationResult = await this.syncCodeService.validateSyncCode(user.lastSyncCode, user.phoneNumber)
            if (validationResult.isValid) {
                // Code is still valid, return existing code
                return user.lastSyncCode
            }
            // Code is expired or invalid, revoke it
            await this.revokeSyncCode()
        }

        // Generate new code
        user.lastSyncCode = await this.syncCodeService.generateSyncCode(this.userId, user.phoneNumber)
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
        return user.lastSyncCode
    }

    async revokeSyncCode(): Promise<boolean> {
        const user = await this.getUser()
        if (user.phoneNumber) {
            if (user.lastSyncCode) {
                await this.syncCodeService.revokeSyncCode(user.lastSyncCode, user.phoneNumber)
                user.lastSyncCode = undefined
                const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
                const stub = this.c.env.USER_DIRECTORY.get(id)
                await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
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
                const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
                const stub = this.c.env.USER_DIRECTORY.get(id)
                await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
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

    async setAllowedEmails(allowedEmails: string[]) {
        const user = await this.getUser()
        user.allowedEmails = allowedEmails
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
    }

    async setConfirmedEmails(confirmedEmails: string[]) {
        const user = await this.getUser()
        user.confirmedEmails = confirmedEmails
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
    }
}