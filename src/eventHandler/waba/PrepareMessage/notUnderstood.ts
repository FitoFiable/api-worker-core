import { notUnderstood as en } from "@/i18n/en/wabaMessages/notUnderstood.js"
import { notUnderstood as es } from "@/i18n/es/wabaMessages/notUnderstood.js"
import { notUnderstood as fr } from "@/i18n/fr/wabaMessages/notUnderstood.js"
import { notUnderstood as de } from "@/i18n/de/wabaMessages/notUnderstood.js"
import { notUnderstood as it } from "@/i18n/it/wabaMessages/notUnderstood.js"
import { notUnderstood as pt } from "@/i18n/pt/wabaMessages/notUnderstood.js"
import type { NotUnderstood } from "@/i18n/types/wabaMessages/notUnderstood.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../wabaService.js"

export const prepareNotUnderstood = (
    to: string,
    lang: string,
    context: requestMetadata
): sendAnyAvailableType[] => {
    const dictionary: Record<string, NotUnderstood> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en

    const messages: sendAnyAvailableType[] = [
        {
            to: to,
            stickerUrl: `https://fitofiable.com/fitofiable/fito_question.webp`,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: `${t.title ? t.title + "\n" : ""}${t.message}`,
            replyToMessageId: context.replyToMessageId,
        }
    ]

    if (t.example) {
        messages.push({
            to: to,
            message: t.example,
            replyToMessageId: context.replyToMessageId,
        })
    }

    return messages
}


