import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../wabaService.js"
import { unableToVerify as en } from "@/i18n/en/wabaMessages/unableToVerify.js"
import { unableToVerify as es } from "@/i18n/es/wabaMessages/unableToVerify.js"
import { unableToVerify as fr } from "@/i18n/fr/wabaMessages/unableToVerify.js"
import { unableToVerify as de } from "@/i18n/de/wabaMessages/unableToVerify.js"
import { unableToVerify as it } from "@/i18n/it/wabaMessages/unableToVerify.js"
import { unableToVerify as pt } from "@/i18n/pt/wabaMessages/unableToVerify.js"
import type { UnableToVerify } from "@/i18n/types/wabaMessages/unableToVerify.js"

export const prepareUnableToVerify = (to: string, lang: string, context: requestMetadata): sendAnyAvailableType[] => {
    const dictionary: Record<string, UnableToVerify> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en

    const url = `${context.frontendUrl}/${lang}`
    const help = t.help.replace('{{url}}', url)

    return [
        {
            to,
            // stickerUrl: `${context.frontendUrl}/fitofiable/fito-sad.webp`,
            stickerUrl: `https://fitofiable.com/fitofiable/fito-sad.webp`,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to,
            message: t.title,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to,
            message: help,
            replyToMessageId: context.replyToMessageId,
        },
    ]
}


