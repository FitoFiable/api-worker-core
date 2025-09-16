export type TransactionParsed = {
  successSingle: string // e.g., "I recorded your transaction."
  successMany: string   // e.g., "I recorded {{count}} transactions."
  followUp?: string     // e.g., "Open your dashboard: {{url}}"
  previewIntro?: string // e.g., "You said:" / "Detected transactions:"
  itemTemplate?: string // e.g., "- {{type}} {{amount}} — {{description}}"
}


