/**
 * ANSI Escape Codes for coloring
 */
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[90m', // Gray
  info: '\x1b[34m',  // Blue
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

/**
 * Formats a date as YYYY-MM-DD HH:mm:ss
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

export function formatPretty(level: string, module: string, message: string, meta?: any): string {
  const timestamp = formatTimestamp(new Date());
  const color = COLORS[level as keyof typeof COLORS] || COLORS.reset;
  const levelStr = level.toUpperCase();
  
  let metaStr = '';
  if (meta !== undefined) {
    if (meta instanceof Error) {
      metaStr = `\n${COLORS.error}${meta.stack || meta.message}${COLORS.reset}`;
    } else {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
  }

  return `[${timestamp}] ${color}[${levelStr}]${COLORS.reset} [${module}] ${message}${metaStr}\n`;
}

export function formatJson(level: string, module: string, message: string, meta?: any): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data: undefined as any,
  };

  if (meta !== undefined) {
    if (meta instanceof Error) {
      entry.data = {
        error: meta.message,
        stack: meta.stack,
      };
    } else {
      entry.data = meta;
    }
  }

  return JSON.stringify(entry) + '\n';
}
