import { Hono } from 'hono'
import { Bindings } from '../bindings.js'

export type MediaContext = { Bindings: Bindings }

/**
 * Media Router for R2 Bucket Operations
 * 
 * Endpoints:
 * - POST /media/upload - Upload a file to R2 bucket (expects base64 data)
 * - GET /media/file/:filename - Download a file from R2 bucket
 * - GET /media/list - List files in R2 bucket (optional utility)
 * - DELETE /media/file/:filename - Delete a file from R2 bucket
 * 
 * Upload request body:
 * {
 *   "base64": "base64-encoded-file-data",
 *   "filename": "original-filename.ext", // optional
 *   "contentType": "image/jpeg" // optional
 * }
 * 
 * Upload response:
 * {
 *   "success": true,
 *   "filename": "generated-unique-filename",
 *   "url": "https://api.fitofiable.com/media/file/generated-filename",
 *   "size": 12345,
 *   "contentType": "image/jpeg"
 * }
 */
const media = new Hono<MediaContext>()

// Upload file to R2 bucket
media.post('/upload', async (c) => {
  try {
    const body = await c.req.json()
    const { base64, filename, contentType } = body

    if (!base64) {
      return c.json({ error: 'Base64 data is required' }, 400)
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const fileExtension = filename ? filename.split('.').pop() : 'bin'
    const uniqueFilename = `media/${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`

    // Convert base64 to Uint8Array
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Upload to R2 bucket
    const uploadResult = await c.env.FITOFIABLE_STORAGE.put(uniqueFilename, bytes, {
      httpMetadata: {
        contentType: contentType || 'application/octet-stream',
      },
    })

    if (!uploadResult) {
      return c.json({ error: 'Failed to upload file to R2' }, 500)
    }

    // Generate public URL (you might want to configure a custom domain)
    const fileUrl = `${c.env.API_URL}/media/file?filename=${uniqueFilename}`

    return c.json({
      success: true,
      filename: uniqueFilename,
      url: fileUrl,
      size: bytes.length,
      contentType: contentType || 'application/octet-stream'
    })

  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Internal server error during upload' }, 500)
  }
})

// Get file from R2 bucket
media.get('/file', async (c) => {
  try {
    const filename = c.req.query('filename')
    
    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400)
    }

    // Get file from R2 bucket
    const file = await c.env.FITOFIABLE_STORAGE.get(filename)

    if (!file) {
      return c.json({ error: 'File not found' }, 404)
    }

    // Set appropriate headers
    const headers = new Headers()
    headers.set('Content-Type', file.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Content-Length', file.size.toString())
    headers.set('Cache-Control', 'public, max-age=31536000') // Cache for 1 year

    return new Response(file.body, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Download error:', error)
    return c.json({ error: 'Internal server error during download' }, 500)
  }
})

// Delete file from R2 bucket
media.delete('/file', async (c) => {
  try {
    const filename = c.req.query('filename')
    
    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400)
    }

    // Delete file from R2 bucket
    await c.env.FITOFIABLE_STORAGE.delete(filename)

    return c.json({
      success: true,
      message: 'File deleted successfully'
    })

  } catch (error) {
    console.error('Delete error:', error)
    return c.json({ error: 'Internal server error during deletion' }, 500)
  }
})

export default media
