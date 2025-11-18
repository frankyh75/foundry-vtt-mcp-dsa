/**
 * Simple logger for Foundry VTT module
 */
export class Logger {
  private context: string;

  constructor(context: string = 'FoundryMCP') {
    this.context = context;
  }

  debug(message: string, data?: any): void {
    console.log(`[${this.context}] ${message}`, data || '');
  }

  info(message: string, data?: any): void {
    console.info(`[${this.context}] ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[${this.context}] ${message}`, data || '');
  }

  error(message: string, error?: any): void {
    console.error(`[${this.context}] ${message}`, error || '');
  }

  child(options: { component?: string }): Logger {
    const childContext = options.component 
      ? `${this.context}:${options.component}`
      : this.context;
    return new Logger(childContext);
  }
}