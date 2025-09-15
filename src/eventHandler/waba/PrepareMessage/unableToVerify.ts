import { sendAnyAvailableType } from "../sendTypes.js"
import { requestMetadata } from "../index.js"

export const prepareUnableToVerify = (to: string, lang: string, context: requestMetadata): sendAnyAvailableType[] => {
    const title = 'I could not verify your code 😕'
    const help = `Please check the code and try again here: ${context.frontendUrl}/${lang}`

    return [
        {
            to,
            // stickerUrl: `${context.frontendUrl}/fitofiable/fito-sad.webp`,
            stickerUrl: `https://fitofiable.com/fitofiable/fito-sad.webp`,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to,
            message: title,
            replyToMessageId: context.replyToMessageId,
        },
        {
            to,
            message: help,
            replyToMessageId: context.replyToMessageId,
        },
    ]
}


