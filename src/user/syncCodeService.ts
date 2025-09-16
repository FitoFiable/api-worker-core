import { Context } from "hono";
import { honoContext } from "@/index.js";

export interface SyncCodeValidationResult {
    isValid: boolean;
    userID?: string;
    error?: string;
}

export class SyncCodeService {
    private readonly c: Context<honoContext>

    constructor(c: Context<honoContext>) {
        this.c = c
    }

    async generateSyncCode(userId: string, phoneNumber: string): Promise<string> {
        // Try up to 10 times to find an available code
        for(let i = 0; i < 10; i++) {
            const newCode = Math.floor(10000 + Math.random() * 90000).toString()
            const existingSync = await this.c.env.FITOFIABLE_KV.get(`syncCode/${newCode}-${phoneNumber}`)
            
            if (!existingSync) {
                // Code doesn't exist, we can use it
                await this.c.env.FITOFIABLE_KV.put(`syncCode/${newCode}-${phoneNumber}`, JSON.stringify({
                    userID: userId,
                    validUntil: Date.now() + 1000 * 60 * 5 // 5 minutes
                }))
                return newCode
            } else {
                // Check if existing code is expired
                const syncData = JSON.parse(existingSync)
                if (syncData.validUntil < Date.now()) {
                    // Expired code, we can reuse this slot
                    await this.c.env.FITOFIABLE_KV.put(`syncCode/${newCode}-${phoneNumber}`, JSON.stringify({
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

    async validateSyncCode(code: string, phoneNumber: string): Promise<SyncCodeValidationResult> {

        console.log('Validating sync code:', code, phoneNumber)
        try {
            // Validate input
            if (!code || typeof code !== 'string' || code.trim() === '') {
                return { isValid: false, error: 'Invalid sync code format' }
            }

            // Get sync code from KV store
            const syncCodeData = await this.c.env.FITOFIABLE_KV.get(`syncCode/${code}-${phoneNumber}`)
            console.log(`Sync code data: syncCode/${code}-${phoneNumber}`, syncCodeData)
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
                await this.c.env.FITOFIABLE_KV.delete(`syncCode/${code}-${phoneNumber}`)
                return { isValid: false, error: 'Sync code has expired' }
            }

            // Code is valid
            return { 
                userID: syncData.userID,
                isValid: true, 
            }

        } catch (error) {
            console.error('Error validating sync code:', error)
            return { 
                isValid: false, 
                error: 'Internal error during validation' 
            }
        }
    }

    

    async revokeSyncCode(code: string, phoneNumber: string): Promise<boolean> {
        try {
            await this.c.env.FITOFIABLE_KV.delete(`syncCode/${code}-${phoneNumber}`)
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
