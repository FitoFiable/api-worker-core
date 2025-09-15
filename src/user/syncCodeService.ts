import { Context } from "hono";
import { honoContext } from "@/index.js";

export interface SyncCodeValidationResult {
    isValid: boolean;
    userId?: string;
    error?: string;
}

export class SyncCodeService {
    private readonly c: Context<honoContext>

    constructor(c: Context<honoContext>) {
        this.c = c
    }

    async generateSyncCode(userId: string): Promise<string> {
        // Try up to 10 times to find an available code
        for(let i = 0; i < 10; i++) {
            const newCode = crypto.randomUUID()
            const existingSync = await this.c.env.FITOFIABLE_KV.get(`syncCode/${newCode}`)
            
            if (!existingSync) {
                // Code doesn't exist, we can use it
                await this.c.env.FITOFIABLE_KV.put(`syncCode/${newCode}`, JSON.stringify({
                    userID: userId,
                    validUntil: Date.now() + 1000 * 60 * 5 // 5 minutes
                }))
                return newCode
            } else {
                // Check if existing code is expired
                const syncData = JSON.parse(existingSync)
                if (syncData.validUntil < Date.now()) {
                    // Expired code, we can reuse this slot
                    await this.c.env.FITOFIABLE_KV.put(`syncCode/${newCode}`, JSON.stringify({
                        userID: userId,
                        validUntil: Date.now() + 1000 * 60 * 5 // 5 minutes
                    }))
                    return newCode
                }
                // If code exists and is valid, continue loop to try another code
            }
        }
        
        throw new Error("Could not generate unique sync code after 10 attempts")
    }

    async validateSyncCode(code: string): Promise<SyncCodeValidationResult> {
        try {
            // Validate input
            if (!code || typeof code !== 'string' || code.trim() === '') {
                return { isValid: false, error: 'Invalid sync code format' }
            }

            // Get sync code from KV store
            const syncCodeData = await this.c.env.FITOFIABLE_KV.get(`syncCode/${code}`)
            
            if (!syncCodeData) {
                return { isValid: false, error: 'Sync code not found' }
            }

            // Parse and validate the sync code data
            let syncData
            try {
                syncData = JSON.parse(syncCodeData)
            } catch (parseError) {
                return { isValid: false, error: 'Invalid sync code data format' }
            }

            // Validate required fields
            if (!syncData.userID || !syncData.validUntil) {
                return { isValid: false, error: 'Sync code data is incomplete' }
            }

            // Check if code has expired
            const currentTime = Date.now()
            if (syncData.validUntil < currentTime) {
                // Clean up expired code
                await this.c.env.FITOFIABLE_KV.delete(`syncCode/${code}`)
                return { isValid: false, error: 'Sync code has expired' }
            }

            // Code is valid
            return { 
                isValid: true, 
                userId: syncData.userID 
            }

        } catch (error) {
            console.error('Error validating sync code:', error)
            return { 
                isValid: false, 
                error: 'Internal error during validation' 
            }
        }
    }

    async revokeSyncCode(code: string): Promise<boolean> {
        try {
            await this.c.env.FITOFIABLE_KV.delete(`syncCode/${code}`)
            return true
        } catch (error) {
            console.error('Error revoking sync code:', error)
            return false
        }
    }

    async cleanupExpiredCodes(): Promise<number> {
        // This is a more advanced cleanup method that could be called periodically
        // For now, we rely on individual validation to clean up expired codes
        return 0
    }
}
