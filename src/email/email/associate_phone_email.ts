// import { Bindings } from "../../bindings.js"
// import { sendMessageRaw } from "../whatsapp_tools/send_abstracts/sendMessageRaw.js"
// import { validateWhatsAppMessage } from "../../utils/whatsapp-validator.js"
// import { EmailData } from "../handle_new_email.js"

// export const associatePhoneEmail = async (jsonEmail: EmailData, env: Bindings) => {
//     const { envelope, subject } = jsonEmail // example subject: "+413122779727+13122887635+5731228374877"
//     const { from } = envelope 

//     // discar if subject does no start with + and it needs only to contain + and numbers
//     if (!subject.match(/^(\+[0-9]+)+$/)) {
//         return
//     }

//     // Get the phone number from the email to
//     const phoneNumbersPrevious = await env.EMAIL_TO_PHONES_KV.get(from)
//     const phonesPrev = phoneNumbersPrevious ? phoneNumbersPrevious.split("+") : []

//     const newPhones = subject.split("+")

//     // Combine previous and new phone numbers, removing duplicates
//     const allPhones = [...new Set([...phonesPrev, ...newPhones])].filter(phone => phone)
    

//     // set new phone numbers string
//     await env.EMAIL_TO_PHONES_KV.put(from, allPhones.join("+"))

//     // Format phone numbers for message
//     const formattedPhones = allPhones.map(phone => `\n ${phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4')}`).join("")

//     // send message to all phones
//     for (const phone of allPhones) {
//         const message = `The email ${from} has been associated with the following phone numbers:${formattedPhones}`
//         const messagePayload = {
//             "messaging_product": "whatsapp",
//             "recipient_type": "individual",
//             "to": phone,
//             "type": "text",
//             "text": { "body": message }
//         };
//         const validatedPayload = validateWhatsAppMessage(messagePayload);
//         await sendMessageRaw(validatedPayload, env) // TODO: CHECK IF CAN FIRE AND FORGET
//     }
// }