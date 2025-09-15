import { gettingStarted as en } from "@/i18n/en/wabaMessages/gettingStarted.js"
import { gettingStarted as es } from "@/i18n/es/wabaMessages/gettingStarted.js"
import { gettingStarted as fr } from "@/i18n/fr/wabaMessages/gettingStarted.js"
import { gettingStarted as de } from "@/i18n/de/wabaMessages/gettingStarted.js"
import { gettingStarted as it } from "@/i18n/it/wabaMessages/gettingStarted.js"
import { gettingStarted as pt } from "@/i18n/pt/wabaMessages/gettingStarted.js"
import { GettingStarted } from "@/i18n/types/wabaMessages/gettingStarted.js"
import { prepareGettingStarted } from "./PrepareMessage/gettingStarted.js"
import { sendAnyAvailableType } from "./sendTypes.js"
import { modelMessageSchema } from "ai"
import { prepareVerifiedMessage } from "./PrepareMessage/verified.js"
import { prepareUnableToVerify } from "./PrepareMessage/unableToVerify.js"
import { prepareHelloVerified } from "./PrepareMessage/helloVerified.js"
import { prepareLanguageChanged } from "./PrepareMessage/languageChanged.js"


export type requestMetadata = {
    replyToMessageId?: string
    frontendUrl?: string
}



export type MassagesToSend = {
    gettingStarted: GettingStarted
}

export class WabaSender {
    private to: string
    public lang: string
    private wabaWorkerUrl: string


    constructor(to: string, lang: string, wabaWorkerUrl: string) {
        this.to = to
        this.lang = lang
        this.wabaWorkerUrl = wabaWorkerUrl

    }

    public setRecipient(to: string) {
        this.to = to
    }

    public setLang(lang: string) {
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt']
        if (supportedLanguages.includes(lang)) {
            this.lang = lang
        } else {
            this.lang = 'en'
        }
    }

    async sendMessage(messages: sendAnyAvailableType[]) {
        try {
            const response = await fetch(`${this.wabaWorkerUrl}/messages/sendMany`, {
            method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(messages)
            })
        
            if (!response.ok) {
              throw new Error(`WABA worker responded with status: ${response.status}`)
            }
        
            return await response.json()
          } catch (error) {
            console.error('Error calling WABA worker:', error)
            throw error
          }
    }


    async sendNoRegisteredMessage(context: requestMetadata) {
        return this.sendMessage(prepareGettingStarted(this.to, this.lang, context))
    }

    async sendVerifiedMessage(context: requestMetadata & { userData?: any }) {
        return this.sendMessage(prepareVerifiedMessage(this.to, this.lang, context))
    }

    async unableToVerifyPhone(context: requestMetadata) {
        return this.sendMessage(prepareUnableToVerify(this.to, this.lang, context))
    }

    async sendHelloVerified(context: requestMetadata & { userData?: any }) {
        return this.sendMessage(prepareHelloVerified(this.to, this.lang, context))
    }

    async sendLanguageChanged(context: requestMetadata & { userData?: any }) {
        return this.sendMessage(prepareLanguageChanged(this.to, this.lang, context))
    }

}



