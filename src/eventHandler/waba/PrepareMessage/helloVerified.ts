import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../index.js"

type HelloVerifiedContext = requestMetadata & {
    userData?: any
}

export const prepareHelloVerified = (to: string, lang: string, context: HelloVerifiedContext): sendAnyAvailableType[] => {
    const userName = context.userData?.userName || context.userData?.name || "there"
    const greetings: Record<string, string> = {
        en: "Hello",
        es: "Hola",
        fr: "Bonjour",
        de: "Hallo",
        it: "Ciao",
        pt: "Olá",
        "pt-br": "Olá"
    }
    const normalized = (lang || 'en').toLowerCase()
    const hello = greetings[normalized] || greetings.en

    return [
        {
            to: to,
            message: `${hello}, ${userName}!`,
            replyToMessageId: context.replyToMessageId,
        }
    ]
}

