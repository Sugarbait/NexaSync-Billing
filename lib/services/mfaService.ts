/**
 * ⚠️ SECURITY CRITICAL FILE - DO NOT MODIFY WITHOUT AUTHORIZATION ⚠️
 *
 * MFA Service - TOTP (Time-based One-Time Password) Implementation
 * Uses Google Authenticator compatible TOTP tokens
 *
 * This file contains cryptographic operations for MFA.
 * Any unauthorized changes could compromise system security.
 *
 * Contact: elitesquadp@protonmail.com for authorization
 */

import { authenticator } from 'otplib'
import QRCode from 'qrcode'

class MFAService {
  /**
   * Generate a new MFA secret for a user
   */
  generateSecret(): string {
    return authenticator.generateSecret()
  }

  /**
   * Generate QR code URL for scanning with authenticator app
   */
  async generateQRCode(email: string, secret: string): Promise<string> {
    const otpauth = authenticator.keyuri(email, 'NexaSync Billing', secret)

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth)
      return qrCodeDataUrl
    } catch (error) {
      console.error('Failed to generate QR code:', error)
      throw new Error('Failed to generate QR code')
    }
  }

  /**
   * Generate backup codes for MFA recovery
   */
  generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      codes.push(code)
    }
    return codes
  }

  /**
   * Verify a TOTP token
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      // Remove any spaces or dashes from the token
      const cleanToken = token.replace(/[\s-]/g, '')

      // Verify the token with a window of ±1 time step (30 seconds)
      return authenticator.verify({
        token: cleanToken,
        secret: secret
      })
    } catch (error) {
      console.error('Token verification failed:', error)
      return false
    }
  }

  /**
   * Get the current TOTP token (for testing purposes)
   */
  generateToken(secret: string): string {
    return authenticator.generate(secret)
  }

  /**
   * Encrypt MFA secret before storing in database
   * NOTE: This is a simple base64 encoding. In production, use proper encryption (AES-256-GCM)
   */
  encryptSecret(secret: string): string {
    // TODO: Replace with actual encryption in production
    return Buffer.from(secret).toString('base64')
  }

  /**
   * Decrypt MFA secret from database
   */
  decryptSecret(encryptedSecret: string): string {
    // TODO: Replace with actual decryption in production
    return Buffer.from(encryptedSecret, 'base64').toString('utf-8')
  }

  /**
   * Format secret for display (shows as XXXX XXXX XXXX XXXX)
   */
  formatSecretForDisplay(secret: string): string {
    return secret.match(/.{1,4}/g)?.join(' ') || secret
  }
}

export const mfaService = new MFAService()
