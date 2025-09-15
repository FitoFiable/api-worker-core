import { Bindings } from "../../bindings.js"
import { EmailData } from "../handle_new_email.js" 


export const googleForwardConfirmation = async (jsonEmail: EmailData, env: Bindings) => {
  const { from, body } = jsonEmail

  // Must be from Google's forwarding system
  if (!from.includes("forwarding-noreply@google.com")) {
    return
  }

  // Find first link in the email body
  const urlMatch = body.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"]+/i)
  if (!urlMatch) {
    console.warn("No confirmation link found in email body")
    return
  }

  // Replace domain
  const confirmationUrl = urlMatch[0].replace(
    "https://mail-settings.google.com",
    "https://mail.google.com"
  )

  try {
    const res = await fetch(confirmationUrl, {
      method: "POST",
      headers: {
        // "Content-Type": "application/x-www-form-urlencoded", // Gmail confirmation links usually expect this
      },
      body: "", // sometimes they just need a POST hit with no body
    })

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`)
    }
    return await res.text()
  } catch (err) {
    console.error("Error confirming Google forwarding:", err)
    throw err
  }
}
