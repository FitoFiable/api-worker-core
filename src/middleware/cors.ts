
export function generateAllowedOrigins(frontendOrigin: string): string[] {
    const origins = [frontendOrigin]
    try {
      const url = new URL(frontendOrigin)
      const hostname = url.hostname
      if (hostname.startsWith('www.')) {
        const nonWwwHostname = hostname.substring(4)
        const nonWwwOrigin = `${url.protocol}//${nonWwwHostname}${url.port ? ':' + url.port : ''}`
        origins.push(nonWwwOrigin)
      } else {
        const wwwHostname = `www.${hostname}`
        const wwwOrigin = `${url.protocol}//${wwwHostname}${url.port ? ':' + url.port : ''}`
        origins.push(wwwOrigin)
      }
    } catch (error) {
      console.warn('Invalid frontend origin URL:', frontendOrigin, error)
    }
    return origins
  }