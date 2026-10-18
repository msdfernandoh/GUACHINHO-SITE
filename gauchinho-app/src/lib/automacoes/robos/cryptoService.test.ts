import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptCredential,
  decryptCredential,
  sanitizarLogs,
  getMasterEncryptionKey,
} from './cryptoService'

describe('Robo Crypto Service', () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-service-role-key-for-unit-tests-12345'
  })

  it('deve cifrar e decifrar credenciais corretamente com AES-256-GCM', () => {
    const raw = 'MinhaSenhaForte@2026'
    const encrypted = encryptCredential(raw)

    expect(encrypted).not.toBe(raw)
    expect(encrypted.split(':')).toHaveLength(3)

    const decrypted = decryptCredential(encrypted)
    expect(decrypted).toBe(raw)
  })

  it('deve retornar string vazia ao cifrar ou decifrar valores vazios', () => {
    expect(encryptCredential('')).toBe('')
    expect(decryptCredential('')).toBe('')
  })

  it('deve sanitizar senhas e tokens em logs', () => {
    const log1 = 'Tentando autenticar com senha: MinhaSenhaSecreta'
    expect(sanitizarLogs(log1)).toContain('[REDACTED]')
    expect(sanitizarLogs(log1)).not.toContain('MinhaSenhaSecreta')

    const log2 = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token'
    expect(sanitizarLogs(log2)).toContain('Bearer [REDACTED]')
  })
})
