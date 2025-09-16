import { eventNotification as En } from "@/i18n/en/wabaMessages/eventNotification.js"
import { eventNotification as Es } from "@/i18n/es/wabaMessages/eventNotification.js"
import { eventNotification as Fr } from "@/i18n/fr/wabaMessages/eventNotification.js"
import { eventNotification as De } from "@/i18n/de/wabaMessages/eventNotification.js"
import { eventNotification as It } from "@/i18n/it/wabaMessages/eventNotification.js"
import { eventNotification as Pt } from "@/i18n/pt/wabaMessages/eventNotification.js"
import type { EventNotification } from "@/i18n/types/wabaMessages/eventNotification.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../wabaService.js"

export const prepareEventNotification = (to: string, lang: string, context: requestMetadata & { title: string, description: string }): sendAnyAvailableType[] => {
    const dictionary: Record<string, EventNotification> = { en: En, es: Es, fr: Fr, de: De, it: It, pt: Pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || En
    return [
        {
            to: to,
            message: `${t.prefix} ${context.title}: ${context.description}`,
            replyToMessageId: context.replyToMessageId,
        }
    ]
}


