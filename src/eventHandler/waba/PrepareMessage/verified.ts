import { verified as en } from "@/i18n/en/wabaMessages/verified.js"
import { verified as es } from "@/i18n/es/wabaMessages/verified.js"
import { verified as fr } from "@/i18n/fr/wabaMessages/verified.js"
import { verified as de } from "@/i18n/de/wabaMessages/verified.js"
import { verified as it } from "@/i18n/it/wabaMessages/verified.js"
import { verified as pt } from "@/i18n/pt/wabaMessages/verified.js"
import type { Verified } from "@/i18n/types/wabaMessages/verified.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../index.js"

// For now reuse GettingStarted types/dictionaries for simplicity; could be specialized later
type VerifiedContext = requestMetadata & { userData?: any }

export const prepareVerifiedMessage = (to: string, lang: string, context: VerifiedContext): sendAnyAvailableType[] => {
    const dictionary: Record<string, Verified> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en

    const url = `${context.frontendUrl}/${lang}`
    const followUpText = t.followUp.replace('{{url}}', url)

    const userName = context.userData?.userName || context.userData?.name

    const messages: sendAnyAvailableType[] = [
        {
            to: to,
            // stickerUrl: `${context.frontendUrl}/fitofiable/fito-hello.webp`,
            stickerUrl: `https://fitofiable.com/fitofiable/fito_celebrate_onboarding.webp`,
            replyToMessageId: context.replyToMessageId,
        }
    ]

    if (userName) {
        messages.push({
            to: to,
            message: `${(lang || 'en').toLowerCase() === 'es' ? 'Hola' : (lang || 'en').toLowerCase() === 'fr' ? 'Bonjour' : (lang || 'en').toLowerCase() === 'de' ? 'Hallo' : (lang || 'en').toLowerCase() === 'it' ? 'Ciao' : 'Hello'}, ${userName}!`,
            replyToMessageId: context.replyToMessageId,
        })
    }

    messages.push(
        {
            to: to,
            message: t.success,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: followUpText,
            replyToMessageId: context.replyToMessageId,
        }
    )

    return messages
}


