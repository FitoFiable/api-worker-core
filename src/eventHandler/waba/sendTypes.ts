// Common types shared across all send message types

// Standardized response format for sent messages
export type StandardizedSendResponse = {
    success: boolean;
    messageId?: string; // Provider-specific message ID if successful
    error?: {
      message: string;
      code?: string | number;
    };
  };
  
  // Standardized input format for sending text messages
  export type StandardizedSendTextInput = {
    to: string; // Recipient identifier (e.g., phone number)
    message: string; // Text content to send
    replyToMessageId?: string; // Optional message ID to reply to
  };
  
  // Standardized input format for sending image messages
  export type StandardizedSendImageInput = {
    to: string; // Recipient identifier (e.g., phone number)
    imageUrl?: string; // URL of the image to send
    imageId?: string; // Media ID of previously uploaded image
    caption?: string; // Optional caption for the image
    replyToMessageId?: string; // Optional message ID to reply to
  };
  
  // List item structure
  export type StandardizedListItem = {
    id: string; // Unique identifier for the list item
    title: string; // Display title for the list item
    description?: string; // Optional description for the list item
  };
  
  // List section structure
  export type StandardizedListSection = {
    title: string; // Section title
    items: StandardizedListItem[]; // Items in this section
  };
  
  // Standardized input format for sending list single select messages
  export type StandardizedSendListSingleSelectInput = {
    to: string; // Recipient identifier (e.g., phone number)
    headerText: string; // Header text for the list
    bodyText: string; // Body text for the list
    footerText?: string; // Optional footer text
    buttonText: string; // Text for the list button
    sections: StandardizedListSection[]; // List sections with items
    replyToMessageId?: string; // Optional message ID to reply to
  };
  
  // Standardized input format for sending reaction messages
  export type StandardizedSendReactionInput = {
    to: string; // Recipient identifier (e.g., phone number)
    emoji: string; // Emoji to send as reaction (e.g., "👍", "❤️", "😂")
    messageId: string; // ID of the message to react to
  };
  
  // Standardized input format for sending sticker messages
  export type StandardizedSendStickerInput = {
    to: string; // Recipient identifier (e.g., phone number)
    stickerUrl?: string; // URL of the sticker to send
    stickerId?: string; // Media ID of previously uploaded sticker if no sticker url is provided
    replyToMessageId?: string; // Optional message ID to reply to
  };
  
  

  export type sendAnyAvailableType = StandardizedSendTextInput | StandardizedSendImageInput | StandardizedSendListSingleSelectInput | StandardizedSendReactionInput | StandardizedSendStickerInput