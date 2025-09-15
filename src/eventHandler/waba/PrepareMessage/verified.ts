import { gettingStarted as en } from "@/i18n/en/wabaMessages/gettingStarted.js"
import { gettingStarted as es } from "@/i18n/es/wabaMessages/gettingStarted.js"
import { gettingStarted as fr } from "@/i18n/fr/wabaMessages/gettingStarted.js"
import { gettingStarted as de } from "@/i18n/de/wabaMessages/gettingStarted.js"
import { gettingStarted as it } from "@/i18n/it/wabaMessages/gettingStarted.js"
import { gettingStarted as pt } from "@/i18n/pt/wabaMessages/gettingStarted.js"
import { GettingStarted } from "@/i18n/types/wabaMessages/gettingStarted.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../index.js"

// For now reuse GettingStarted types/dictionaries for simplicity; could be specialized later
export const prepareVerifiedMessage = (to: string, lang: string, context: requestMetadata): sendAnyAvailableType[] => {
    const dictionary: Record<string, GettingStarted> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en

    const successText = 'Your phone has been verified successfully!'
    const followUpText = `You can now continue here: ${context.frontendUrl}/${lang}`

    return [
        {
            to: to,
            // stickerUrl: `${context.frontendUrl}/fitofiable/fito-hello.webp`,
            stickerUrl: `https://fitofiable.com/fitofiable/fito-hello.webp`,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: successText,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: followUpText,
            replyToMessageId: context.replyToMessageId,
        }
    ]
}


