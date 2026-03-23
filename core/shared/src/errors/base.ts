export class OrbisError extends Error {
  public readonly code: string;
  public readonly module: string;
  public override readonly cause?: unknown;

  constructor(message: string, options: { code: string; module: string; cause?: unknown }) {
    // Pass message to native Error
    super(message);
    
    this.name = this.constructor.name;
    this.code = options.code;
    this.module = options.module;
    this.cause = options.cause;

    // Maintain proper stack trace (native in V8/Bun)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Helper to format the full error message including module and code
   */
  override toString(): string {
    return `[${this.module}] ${this.code}: ${this.message}`;
  }
}
