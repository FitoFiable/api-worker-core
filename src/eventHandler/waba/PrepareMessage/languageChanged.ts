import { languageChanged as en } from "@/i18n/en/wabaMessages/languageChanged.js"
import { languageChanged as es } from "@/i18n/es/wabaMessages/languageChanged.js"
import { languageChanged as fr } from "@/i18n/fr/wabaMessages/languageChanged.js"
import { languageChanged as de } from "@/i18n/de/wabaMessages/languageChanged.js"
import { languageChanged as it } from "@/i18n/it/wabaMessages/languageChanged.js"
import { languageChanged as pt } from "@/i18n/pt/wabaMessages/languageChanged.js"
import type { LanguageChanged } from "@/i18n/types/wabaMessages/languageChanged.js"
import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../wabaService.js"

type LanguageChangedContext = requestMetadata & { userData?: any }

export const prepareLanguageChanged = (to: string, lang: string, context: LanguageChangedContext): sendAnyAvailableType[] => {
    const dictionary: Record<string, LanguageChanged> = { en, es, fr, de, it, pt }
    const normalized = (lang || 'en').toLowerCase()
    const t = dictionary[normalized] || en

    const userName = context.userData?.userName || context.userData?.name

    const messages: sendAnyAvailableType[] = [
        {
            to: to,
            stickerUrl: `https://fitofiable.com/fitofiable/fito_poliglot.webp`,
            replyToMessageId: context.replyToMessageId,
        }
    ]

    if (userName) {
        messages.push({
            to: to,
            message: `${t.message} ${userName}!`,
            replyToMessageId: context.replyToMessageId,
        })
    } else {
        messages.push({
            to: to,
            message: t.message,
            replyToMessageId: context.replyToMessageId,
        })
    }

    return messages
}
