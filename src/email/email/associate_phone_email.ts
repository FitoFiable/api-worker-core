import { Bindings } from "../../bindings.js"
// import { sendMessageRaw } from "../whatsapp_tools/send_abstracts/sendMessageRaw.js"
// import { validateWhatsAppMessage } from "../../utils/whatsapp-validator.js"
import { honoContext } from "../../index.js"
import { EmailData } from "../handle_new_email.js"
import { Context } from "hono"
import { EmailService } from "../../user/emailService.js"
import { PhoneService } from "../../user/phoneService.js"
import { User } from "../../user/userMainService.js"

export const associatePhoneEmail = async (jsonEmail: EmailData, c: Context<honoContext>) => {
    const { envelope, subject } = jsonEmail // example subject: "573122779727"
    const { from } = envelope 
    // Check if subject contains only numbers (no spaces, no +)
    if (!/^\d+$/.test(subject)) {
        return
    }
    const emailService = new EmailService(c)
    await emailService.assingPhoneToEmail(from, subject)

    const phoneService = new PhoneService(c)
    const userID = await phoneService.getUserByPhoneNumber(subject)
    if (!userID) {
        return
    }

    const user = new User(c, userID)
    const userData = await user.getUser()
    const confirmedEmails = userData.confirmedEmails ?? []
    if (confirmedEmails.includes(from)) {
        return
    }
    await user.setConfirmedEmails([...confirmedEmails, from])





    //  userID = await emailService.getUserByEmail(from)
    // if (!userID) {
    //     return
    // }




    // // Get the phone number from the email to
    // const phoneNumbersPrevious = await env.EMAIL_TO_PHONES_KV.get(from)
    // const phonesPrev = phoneNumbersPrevious ? phoneNumbersPrevious.split("+") : []

    // const newPhones = subject.split("+")

    // // Combine previous and new phone numbers, removing duplicates
    // const allPhones = [...new Set([...phonesPrev, ...newPhones])].filter(phone => phone)
    

    // // set new phone numbers string
    // await env.EMAIL_TO_PHONES_KV.put(from, allPhones.join("+"))

    // // Format phone numbers for message
    // const formattedPhones = allPhones.map(phone => `\n ${phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4')}`).join("")

    // // send message to all phones
    // for (const phone of allPhones) {
    //     const message = `The email ${from} has been associated with the following phone numbers:${formattedPhones}`
    //     const messagePayload = {
    //         "messaging_product": "whatsapp",
    //         "recipient_type": "individual",
    //         "to": phone,
    //         "type": "text",
    //         "text": { "body": message }
    //     };
    //     const validatedPayload = validateWhatsAppMessage(messagePayload);
    //     await sendMessageRaw(validatedPayload, env) // TODO: CHECK IF CAN FIRE AND FORGET
    // }
}