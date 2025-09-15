export const getLanguageByPhoneNumber = (phoneNumber: string): "en" | "es" | "fr" | "de" | "it" | "pt" => {
    // Normalize: keep digits only, so formats like "+1", "001", spaces, dashes are handled
    const digitsOnly = (phoneNumber || "").replace(/\D/g, "")

    // Country calling codes are 1–3 digits. Try to match the longest first.
    const prefixesToTry: string[] = []
    if (digitsOnly.length >= 3) prefixesToTry.push(digitsOnly.slice(0, 3))
    if (digitsOnly.length >= 2) prefixesToTry.push(digitsOnly.slice(0, 2))
    if (digitsOnly.length >= 1) prefixesToTry.push(digitsOnly.slice(0, 1))

    // Best-effort mapping from calling code to default language for the user base
    // Note: Many countries are multilingual; this is a pragmatic default, not definitive.
    const codeToLang: Record<string, "en" | "es" | "fr" | "de" | "it" | "pt"> = {
        // English (NANP + common English-speaking countries)
        "1": "en", // US/Canada and other NANP regions
        "44": "en", // UK
        "61": "en", // Australia
        "64": "en", // New Zealand
        "65": "en", // Singapore (multi)
        "353": "en", // Ireland
        "27": "en", // South Africa (multi)
        "234": "en", // Nigeria (multi)
        "91": "en", // India (multi)

        // Spanish
        "34": "es", // Spain
        "52": "es", // Mexico
        "57": "es", // Colombia
        "51": "es", // Peru
        "54": "es", // Argentina
        "56": "es", // Chile
        "58": "es", // Venezuela
        "593": "es", // Ecuador
        "595": "es", // Paraguay
        "598": "es", // Uruguay
        "507": "es", // Panama
        "506": "es", // Costa Rica
        "505": "es", // Nicaragua
        "504": "es", // Honduras
        "503": "es", // El Salvador
        "502": "es", // Guatemala
        "53": "es", // Cuba

        // French
        "33": "fr", // France
        "32": "fr", // Belgium (multi)
        "241": "fr", // Gabon
        "225": "fr", // Cote d'Ivoire
        "221": "fr", // Senegal
        "213": "fr", // Algeria (Arabic/French)
        "216": "fr", // Tunisia (Arabic/French)
        "212": "fr", // Morocco (Arabic/French)
        "590": "fr", // Guadeloupe
        "596": "fr", // Martinique
        "594": "fr", // French Guiana
        "262": "fr", // Réunion/Mayotte

        // German
        "49": "de", // Germany
        "43": "de", // Austria
        "41": "de", // Switzerland (multi)

        // Italian
        "39": "it", // Italy
        "379": "it", // Vatican City (shared with 39)

        // Portuguese
        "351": "pt", // Portugal
        "55": "pt", // Brazil
        "238": "pt", // Cape Verde
        "239": "pt", // São Tomé and Príncipe
        "244": "pt", // Angola
        "245": "pt", // Guinea-Bissau
        "258": "pt", // Mozambique
    }

    for (const prefix of prefixesToTry) {
        const lang = codeToLang[prefix]
        if (lang) return lang
    }

    // Default fallback
    return "en"
}