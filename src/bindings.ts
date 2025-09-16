export type Bindings = {

    // BINDINGS DE SERVICIOS DE CLOUDFLARE: SE REGISTRAN EN EL ARCHIVO wrangler.jsonc y se crean en la UI de Cloudflare
    FITOFIABLE_R2: R2Bucket
    FITOFIABLE_KV: KVNamespace
    EMAIL_DIRECTORY: DurableObjectNamespace
    PHONE_DIRECTORY: DurableObjectNamespace
    SYNC_CODE_REGISTRY: DurableObjectNamespace
    
    // VARIABLES: SE REGISTRAN EN EL ARCHIVO wrangler.jsonc
    FRONTEND_ORIGIN: string
    OIDC_ISSUER: string
    OIDC_CLIENT_ID: string 
    OIDC_REDIRECT_URI: string
    OIDC_SCOPES: string
    API_URL: string
    COGNITO_HOSTED_UI_URL: string
    API_LAMBDA_URL: string
    WABA_WORKER_URL: string
    
    
    // SECRETOS: SE DEBEN REGISTRAR MANUALMENTE EN LA UI DE CLOUDFLARE
    GEMINI_API_KEY: string    
    OIDC_CLIENT_SECRET: string
    OIDC_AUTH_SECRET: string
}