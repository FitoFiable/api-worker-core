import { Hono, Next } from 'hono'
import { getAuth } from '@hono/oidc-auth'
import { honoContext } from '../index.js'
import {WabaSender} from './waba/index.js'
import { Context } from 'hono'
import { SyncCodeService } from '../user/syncCodeService.js'
import { User } from '../user/user.js'
import { PhoneService } from '../user/phoneService.js'

const eventHandlerRoutes = new Hono<honoContext>()

export type StandardizedMessageReceived = {
    messageId?: string; // Unique identifier for the message if available
    sender: string; // Sender of the message ejm. phone number
    receiver: string; // Receiver of the message ejm. phone number
    timestamp: string; // Timestamp of the message
    messageType: "text" | "audio" | "image" | "list_reply"; // Type of the message
    asociatedMessageId?: string; // MessageId of the message that this message is associated with (e.g. a reply to a message)
    associatedMediaUrl?: string; // URL of the media that this message is associated with (e.g. a reply to a message)
    content: string; // Content of the message - always a string for simplicity (audio and images are converted to a string)
  };
  



// Middleware for authenticated users
eventHandlerRoutes.use('*', async (c, next: Next) => {
  c.set('WabaSender', new WabaSender("", "fr", c.env.WABA_WORKER_URL))
  c.set('SyncCodeService', new SyncCodeService(c))
  c.set('PhoneService', new PhoneService(c))
  await next()
})



eventHandlerRoutes.post('/standarizedInput', async (c) => {
  try {
    const messageReceived: StandardizedMessageReceived = await c.req.json()
    
    console.log('Received standardized message:', messageReceived)
    
    // Get WABA worker URL from environment
    const wabaWorkerUrl = c.env.WABA_WORKER_URL || 'http://localhost:8004'
    
    if (!messageReceived) {
      return c.json({ error: 'Missing standardizedMessage in request body' }, 400)
    }

    // Determine message type and call appropriate WABA endpoint
    let wabaResponse: any
    
    
    const sender = c.get('WabaSender')
    sender.setRecipient(messageReceived.sender)

    const fiveDigitMatch = messageReceived.content.match(/\b\d{5}\b/)
    const fiveDigitNumber = fiveDigitMatch ? parseInt(fiveDigitMatch[0]) : null
    
    const phoneService = c.get('PhoneService')
    const userID = await phoneService.getUserByPhoneNumber(messageReceived.sender)
    
    if (userID) {
       const user = new User(c, userID)
       const userData = await user.getUser()
       wabaResponse = await sender.sendHelloVerified({userData,replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
    } else {
      if (fiveDigitNumber) {
        const validationResult = await c.get('SyncCodeService').validateSyncCode(fiveDigitNumber.toString(), messageReceived.sender)
        if (validationResult.isValid) {
          const user = new User(c, validationResult.userID!)
          const verified = await user.verifyPhone(validationResult)
          if (verified) {
            const userData = await user.getUser()
            wabaResponse = await sender.sendVerifiedMessage({userData, replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
          }
        }else {
          wabaResponse = await sender.unableToVerifyPhone({replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
        }
      } else {
        wabaResponse = await sender.sendNoRegisteredMessage({replyToMessageId: messageReceived.asociatedMessageId, frontendUrl: c.env.FRONTEND_ORIGIN})
      }

    }

    return c.json({
      success: true,
      message: 'Message processed and sent via WABA worker',
      wabaResponse
    })
    
  } catch (error) {
    console.error('Error processing standardized message:', error)
    return c.json({ 
      error: 'Failed to process standardized message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default eventHandlerRoutes
