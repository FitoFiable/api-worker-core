import { transactionParsed as en } from "@/i18n/en/wabaMessages/transactionParsed.js"
import { transactionParsed as es } from "@/i18n/es/wabaMessages/transactionParsed.js"
import { transactionParsed as fr } from "@/i18n/fr/wabaMessages/transactionParsed.js"
import { transactionParsed as de } from "@/i18n/de/wabaMessages/transactionParsed.js"
import { transactionParsed as it } from "@/i18n/it/wabaMessages/transactionParsed.js"
import { transactionParsed as pt } from "@/i18n/pt/wabaMessages/transactionParsed.js"
import type { TransactionParsed } from "@/i18n/types/wabaMessages/transactionParsed.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../wabaService.js"

export const prepareTransactionParsed = (
    to: string,
    lang: string,
    context: requestMetadata & { count: number, originalMessage?: string, items?: { type: string, amount: number, description: string }[] }
): sendAnyAvailableType[] => {
    const dictionary: Record<string, TransactionParsed> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en

    const url = `${context.frontendUrl}/${lang}`
    const success = context.count === 1 ? t.successSingle : t.successMany.replace('{{count}}', String(context.count))

    const messages: sendAnyAvailableType[] = [
        {
            to: to,
            stickerUrl: `https://fitofiable.com/fitofiable/fito_celebrate_onboarding.webp`,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to: to,
            message: success,
            replyToMessageId: context.replyToMessageId,
        }
    ]

    if (t.previewIntro) {
        const intro = t.previewIntro.replace('{{message}}', context.originalMessage ?? '')
        messages.push({
            to: to,
            message: intro,
            replyToMessageId: context.replyToMessageId,
        })
    }

    if (t.itemTemplate && context.items && context.items.length) {
        const lines = context.items.map(it => t.itemTemplate!
            .replace('{{type}}', it.type)
            .replace('{{amount}}', (it.amount < 0 ? '-' : '') + '$' + Math.abs(it.amount).toLocaleString('es-CO'))
            .replace('{{description}}', it.description)
        )
        messages.push({
            to: to,
            message: lines.join('\n'),
            replyToMessageId: context.replyToMessageId,
        })
    }

    if (t.followUp) {
        messages.push({
            to: to,
            message: t.followUp.replace('{{url}}', url),
            replyToMessageId: context.replyToMessageId,
        })
    }

    return messages
}
