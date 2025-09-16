import { Context } from "hono";
import { honoContext } from "@/index.js";
import { SyncCodeService, SyncCodeValidationResult } from "./syncCodeService.js";
import { PhoneService } from "./phoneService.js";
import { WabaSender } from "@/eventHandler/waba/wabaService.js";
import type { userKV } from "./userKV.types.js";
import type { UserTransaction } from "@/do/TransactionLog.js";

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
        // Initialize WabaSender asynchronously in constructor
        this.initWabaSender().catch(err => {
            console.error('Failed to initialize WabaSender:', err)
        })
    }

    async deleteAllUserData(): Promise<void> {
        const user = await this.getUser()
        const userPhone = user.phoneNumber

        // 1) Delete user document from UserDirectory
        {
            const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
            const stub = this.c.env.USER_DIRECTORY.get(id)
            await stub.fetch('https://do/user-directory', { method: 'DELETE' })
        }

        // 2) Delete transactions
        {
            const id = this.c.env.TRANSACTION_LOG.idFromName(this.userId)
            const stub = this.c.env.TRANSACTION_LOG.get(id)
            await stub.fetch('https://do/transaction-log', { method: 'DELETE' })
        }

        // 3) Delete events
        {
            const id = this.c.env.EVENT_LOG.idFromName(this.userId)
            const stub = this.c.env.EVENT_LOG.get(id)
            await stub.fetch('https://do/event-log', { method: 'DELETE' })
        }

        // 4) Revoke sync code if any
        try {
            await this.revokeSyncCode()
        } catch (_) {
            // ignore if missing
        }

        // 5) Remove phone mapping if any
        if (userPhone) {
            try {
                await this.phoneService.unassignPhoneNumber(userPhone)
            } catch (err) {
                console.error('Failed to unassign phone mapping during user delete:', err)
            }
        }

        // 6) Emit final event (best-effort; after deletes it's fine if it fails)
        try {
            await this.emitEvent('user', 'User data deleted', `All data for user ${this.userId} was deleted`)
        } catch (err) {
            console.error('Failed to emit delete event:', err)
        }
    }

    async initWabaSender(): Promise<WabaSender | null> {
        const user = await this.getUser()

        if (!user.phoneVerified || !user.phoneNumber) {
            this.wabaSender = null
            return null
        }

        const language = user.language ?? 'en'
        this.wabaSender = new WabaSender(user.phoneNumber, language, this.c.env.WABA_WORKER_URL)
        return this.wabaSender
    }

    private async emitEvent(category: 'email' | 'phone' | 'user' | 'payment' | 'system' | 'notification' | 'info' | 'warning' | 'success' | 'error', title: string, description: string) {
        const id = this.c.env.EVENT_LOG.idFromName(this.userId)
        const stub = this.c.env.EVENT_LOG.get(id)
        await stub.fetch('https://do/event-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, category })
        })

        // Attempt to notify user via WABA if we can
        try {
            if (!this.wabaSender) {
                await this.initWabaSender()
            }
            if (this.wabaSender) {
                await this.wabaSender.sendEventNotification({ title, description, frontendUrl: this.c.env.FRONTEND_ORIGIN })
            }
        } catch (err) {
            console.error('Failed to send WABA event notification:', err)
        }
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
        await this.emitEvent('user', 'User name updated', `User name set to ${userName}`)
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
        await this.emitEvent('user', 'Language updated', `Language set to ${language}`)
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
        await this.emitEvent('phone', 'Phone updated', `Phone set to ${user.phoneNumber}`)
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
        await this.emitEvent('phone', 'Sync code generated', `Code generated for ${user.phoneNumber}`)
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
                await this.emitEvent('phone', 'Sync code revoked', `Code revoked for ${user.phoneNumber}`)
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
                await this.emitEvent('phone', 'Phone verified', `Phone ${user.phoneNumber} verified`)
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
        await this.emitEvent('email', 'Allowed emails updated', `Allowed emails set (${allowedEmails.length})`)
    }

    async setConfirmedEmails(confirmedEmails: string[]) {
        const user = await this.getUser()
        user.confirmedEmails = confirmedEmails
        const id = this.c.env.USER_DIRECTORY.idFromName(this.userId)
        const stub = this.c.env.USER_DIRECTORY.get(id)
        await stub.fetch('https://do/user-directory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) })
        await this.emitEvent('email', 'Confirmed emails updated', `Confirmed emails set (${confirmedEmails.length})`)
    }

    async addTransactions(transactions: UserTransaction[] | UserTransaction): Promise<{ added: number }>{
        const list = Array.isArray(transactions) ? transactions : [transactions]
        // Ensure categories exist for user and map all transactions' category to one of them
        const config = await this.getTransactionsConfig().catch(() => ({ categories: ['Food','Leisure','Education','Other','Emergence'], budgets: {} }))
        const allowed = new Set((config.categories && config.categories.length ? config.categories : ['Food','Leisure','Education','Other','Emergence']).map(c => c.trim()))
        const normalizedList = list.map(t => {
            const cat = (t.category || '').trim()
            const matched = allowed.has(cat) ? cat : 'Other'
            return { ...t, category: matched }
        })
        const id = this.c.env.TRANSACTION_LOG.idFromName(this.userId)
        const stub = this.c.env.TRANSACTION_LOG.get(id)
        const res = await stub.fetch('https://do/transaction-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: normalizedList })
        })
        if (!res.ok) throw new Error(`TransactionLog DO error: ${res.status}`)
        const body = await res.json() as { ok: boolean, added: number }
        await this.emitEvent('payment', 'Transaction registered', `${normalizedList.length} transaction(s) added`)
        return { added: body.added }
    }

    async getTransactions(opts?: { limit?: number, cursor?: number|null }): Promise<{ transactions: UserTransaction[], nextCursor: number | null, total: number }>{
        const id = this.c.env.TRANSACTION_LOG.idFromName(this.userId)
        const stub = this.c.env.TRANSACTION_LOG.get(id)
        const params = new URLSearchParams()
        if (opts?.limit) params.set('limit', String(opts.limit))
        if (opts?.cursor != null) params.set('cursor', String(opts.cursor))
        const res = await stub.fetch(`https://do/transaction-log${params.toString() ? `?${params.toString()}` : ''}`)
        if (!res.ok) throw new Error(`TransactionLog DO error: ${res.status}`)
        return await res.json() as { transactions: UserTransaction[], nextCursor: number | null, total: number }
    }

    async getTransactionsConfig(): Promise<{ categories: string[], budgets: Record<string, number> }>{
        const id = this.c.env.TRANSACTION_LOG.idFromName(this.userId)
        const stub = this.c.env.TRANSACTION_LOG.get(id)
        const res = await stub.fetch('https://do/transaction-log/config')
        if (!res.ok) throw new Error(`TransactionLog DO error: ${res.status}`)
        return await res.json() as { categories: string[], budgets: Record<string, number> }
    }

    async setTransactionsConfig(config: Partial<{ categories: string[], budgets: Record<string, number> }>): Promise<{ categories: string[], budgets: Record<string, number> }>{
        const id = this.c.env.TRANSACTION_LOG.idFromName(this.userId)
        const stub = this.c.env.TRANSACTION_LOG.get(id)
        const res = await stub.fetch('https://do/transaction-log/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        if (!res.ok) throw new Error(`TransactionLog DO error: ${res.status}`)
        return await res.json() as { categories: string[], budgets: Record<string, number> }
    }

    async updateTransaction(id: string, patch: Partial<UserTransaction>): Promise<UserTransaction> {
        const doId = this.c.env.TRANSACTION_LOG.idFromName(this.userId)
        const stub = this.c.env.TRANSACTION_LOG.get(doId)
        const params = new URLSearchParams({ id })
        const res = await stub.fetch(`https://do/transaction-log?${params.toString()}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        })
        if (!res.ok) throw new Error(`TransactionLog DO error: ${res.status}`)
        return await res.json() as UserTransaction
    }
}