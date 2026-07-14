import { LoggerLike } from "./types.js";

function format(scope: string, level: string, message: string, details?: Record<string, unknown>): string {
  const prefix = `[${new Date().toISOString()}] [${level}] [${scope}] ${message}`;
  if (!details || Object.keys(details).length === 0) {
    return prefix;
  }
  return `${prefix} ${JSON.stringify(details)}`;
}

export class ConsoleLogger implements LoggerLike {
  constructor(private readonly scope = "starwave") {}

  debug(message: string, details?: Record<string, unknown>): void {
    console.debug(format(this.scope, "DEBUG", message, details));
  }

  info(message: string, details?: Record<string, unknown>): void {
    console.log(format(this.scope, "INFO", message, details));
  }

  warn(message: string, details?: Record<string, unknown>): void {
    console.warn(format(this.scope, "WARN", message, details));
  }

  error(message: string, details?: Record<string, unknown>): void {
    console.error(format(this.scope, "ERROR", message, details));
  }
}

export function childLogger(parent: LoggerLike, scope: string): LoggerLike {
  return {
    debug(message, details) {
      parent.debug(`${scope}: ${message}`, details);
    },
    info(message, details) {
      parent.info(`${scope}: ${message}`, details);
    },
    warn(message, details) {
      parent.warn(`${scope}: ${message}`, details);
    },
    error(message, details) {
      parent.error(`${scope}: ${message}`, details);
    },
  };
}
