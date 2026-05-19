/**
 * Circuit Breaker Pattern for fault-tolerant external API calls.
 * 
 * States:
 *   CLOSED   — Normal operation. Failures increment the counter.
 *   OPEN     — Too many failures. All calls rejected until cooldown expires.
 *   HALF_OPEN — Cooldown expired. Next call is a probe; success resets, failure re-opens.
 */
export class CircuitBreaker {
  /**
   * @param {string} name        Human-readable name for logging.
   * @param {number} threshold   Consecutive failures before opening the circuit.
   * @param {number} cooldownMs  How long (ms) the circuit stays open before half-open probe.
   */
  constructor(name = 'Default', threshold = 3, cooldownMs = 5 * 60 * 1000) {
    this.name = name;
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.failures = 0;
    this.openUntil = 0;
    this.state = 'CLOSED';
    this.lastError = null;
  }

  /**
   * Wraps `fn` with circuit breaker logic.
   * @param {Function} fn  Async function to protect.
   * @returns {Promise<any>}
   */
  async call(fn) {
    // If circuit is OPEN, check if cooldown has elapsed
    if (this.state === 'OPEN') {
      if (Date.now() < this.openUntil) {
        const retryIn = Math.round((this.openUntil - Date.now()) / 1000);
        throw new Error(
          `[CircuitBreaker:${this.name}] OPEN — retry in ${retryIn}s (last error: ${this.lastError})`
        );
      }
      // Cooldown elapsed → transition to HALF_OPEN for a single probe
      this.state = 'HALF_OPEN';
      console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN (probe attempt)`);
    }

    try {
      const result = await fn();
      // Success: reset everything
      if (this.failures > 0 || this.state !== 'CLOSED') {
        console.log(`[CircuitBreaker:${this.name}] Success — circuit CLOSED`);
      }
      this.failures = 0;
      this.state = 'CLOSED';
      this.lastError = null;
      return result;
    } catch (err) {
      this.failures++;
      this.lastError = err.message;

      if (this.failures >= this.threshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
        this.openUntil = Date.now() + this.cooldownMs;
        console.error(
          `[CircuitBreaker:${this.name}] OPENED after ${this.failures} failures. ` +
          `Cooldown until ${new Date(this.openUntil).toISOString()}`
        );
      }

      throw err;
    }
  }

  /** Returns the current state for health-check endpoints. */
  getStatus() {
    // Auto-transition from OPEN to HALF_OPEN if cooldown has elapsed (for status queries)
    if (this.state === 'OPEN' && Date.now() >= this.openUntil) {
      this.state = 'HALF_OPEN';
    }
    return {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
      openUntil: this.state === 'OPEN' ? this.openUntil : null,
      lastError: this.lastError
    };
  }
}

// Pre-configured breakers for each external dependency
export const binanceBreaker = new CircuitBreaker('Binance', 3, 10 * 60 * 1000); // 10-min cooldown
export const geminiBreaker = new CircuitBreaker('GeminiAI', 5, 5 * 60 * 1000);  // 5-min cooldown
