/**
 * Servico de Criptografia Segura e Sanitizacao de Credenciais dos Robos de Importacao.
 * Utiliza AES-256-GCM.
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16

export const ERROR_KEY_NOT_CONFIGURED = 'ROBO_CREDENTIALS_KEY_NOT_CONFIGURED'

export function getMasterEncryptionKey(): Buffer {
  const customKey = process.env.ROBO_CREDENTIALS_ENCRYPTION_KEY
  const fallbackSource = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (customKey && customKey.trim() !== '') {
    const trimmed = customKey.trim()
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex')
    }
    try {
      const decoded = Buffer.from(trimmed, 'base64')
      if (decoded.length === 32) return decoded
    } catch {
      // continua para fallback derivado
    }
    return crypto.createHash('sha256').update(trimmed).digest()
  }

  if (fallbackSource && fallbackSource.trim() !== '') {
    return crypto.createHash('sha256').update(fallbackSource.trim()).digest()
  }

  throw new Error(
    `${ERROR_KEY_NOT_CONFIGURED}: Chave de criptografia de credenciais nao configurada. Defina ROBO_CREDENTIALS_ENCRYPTION_KEY ou SUPABASE_SERVICE_ROLE_KEY.`
  )
}

export function isRoboCredentialsKeyConfigured(): boolean {
  try {
    getMasterEncryptionKey()
    return true
  } catch {
    return false
  }
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext || plaintext.trim() === '') return ''
  const key = getMasterEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptCredential(encryptedPayload: string): string {
  if (!encryptedPayload || !encryptedPayload.includes(':')) return ''
  const parts = encryptedPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Payload criptografado em formato invalido.')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts
  const key = getMasterEncryptionKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function sanitizarLogs(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/(password|senha|secret|token|api_key|authorization|bearer)\s*[:=]\s*["']?([^"'\s,;]+)["']?/gi, '$1: [REDACTED]')
    .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, 'Basic [REDACTED]')
}
