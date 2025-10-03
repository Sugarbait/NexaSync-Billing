/**
 * Currency Service for USD to CAD Conversion
 * From CareXPS CRM - Production tested
 *
 * Uses a fixed exchange rate of 1.45 CAD per USD for consistent pricing.
 * This rate includes a buffer to protect against exchange rate fluctuations.
 */

class CurrencyService {
  // Fixed exchange rate: 1 USD = 1.45 CAD
  private readonly FIXED_RATE: number = 1.45

  constructor() {
    console.log('💱 Currency service initialized with fixed rate:', this.FIXED_RATE, 'CAD per USD')
  }

  /**
   * Convert USD amount to CAD using fixed exchange rate
   */
  public convertUSDToCAD(usdAmount: number): number {
    if (!usdAmount || usdAmount <= 0) return 0
    return usdAmount * this.FIXED_RATE
  }

  /**
   * Get current exchange rate
   */
  public getCurrentRate(): number {
    return this.FIXED_RATE
  }

  /**
   * Get last update time (returns current date for fixed rate)
   */
  public getLastUpdate(): Date {
    return new Date()
  }

  /**
   * Format CAD amount for display
   */
  public formatCAD(cadAmount: number): string {
    return `CAD $${cadAmount.toFixed(2)}`
  }

  /**
   * Get rate source information
   */
  public getRateInfo(): string {
    return 'Fixed rate: 1.45 CAD per USD'
  }

  /**
   * Manual rate refresh (no-op for fixed rate)
   */
  public async forceUpdate(): Promise<boolean> {
    console.log('💱 Using fixed exchange rate - no updates needed')
    return true
  }

  /**
   * Cleanup when service is destroyed (no-op for fixed rate)
   */
  public destroy() {
    // No cleanup needed for fixed rate
  }
}

// Export singleton instance
export const currencyService = new CurrencyService()
export default currencyService
