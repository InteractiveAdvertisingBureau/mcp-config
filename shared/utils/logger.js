// Simple logger utility with colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class Logger {
  constructor(module = 'App') {
    this.module = module;
  }

  info(message, ...args) {
    console.log(`${colors.blue}ℹ [${this.module}]${colors.reset} ${message}`, ...args);
  }

  success(message, ...args) {
    console.log(`${colors.green}✓ [${this.module}]${colors.reset} ${message}`, ...args);
  }

  warn(message, ...args) {
    console.warn(`${colors.yellow}⚠ [${this.module}]${colors.reset} ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`${colors.red}✗ [${this.module}]${colors.reset} ${message}`, ...args);
  }

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.magenta}⚙ [${this.module}]${colors.reset} ${message}`, ...args);
    }
  }
}

export function createLogger(moduleName) {
  return new Logger(moduleName);
}

export default new Logger();
