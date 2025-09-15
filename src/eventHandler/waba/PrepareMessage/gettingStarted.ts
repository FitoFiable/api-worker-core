import { gettingStarted as en } from "@/i18n/en/wabaMessages/gettingStarted.js"
import { gettingStarted as es } from "@/i18n/es/wabaMessages/gettingStarted.js"
import { gettingStarted as fr } from "@/i18n/fr/wabaMessages/gettingStarted.js"
import { gettingStarted as de } from "@/i18n/de/wabaMessages/gettingStarted.js"
import { gettingStarted as it } from "@/i18n/it/wabaMessages/gettingStarted.js"
import { gettingStarted as pt } from "@/i18n/pt/wabaMessages/gettingStarted.js"
import { GettingStarted } from "@/i18n/types/wabaMessages/gettingStarted.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../index.js"
export const prepareGettingStarted = (to: string, lang: string, context: requestMetadata): sendAnyAvailableType[] => {
    const dictionary: Record<string, GettingStarted> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en
    return [
        {
            to: to,
            // stickerUrl: `${context.frontendUrl}/fitofiable/fito.webp`,
            stickerUrl: `https://fitofiable.com/fitofiable/fito.webp`,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: t.message,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: `${context.frontendUrl}/${lang}`,
            replyToMessageId: context.replyToMessageId,
        }
    ]
}
