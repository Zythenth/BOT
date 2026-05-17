type LogLevel = "info" | "warn" | "error";

export const logger = {
  info(message: string, meta?: unknown): void {
    writeLog("info", message, meta);
  },
  warn(message: string, meta?: unknown): void {
    writeLog("warn", message, meta);
  },
  error(message: string, meta?: unknown): void {
    writeLog("error", message, meta);
  }
};

function writeLog(level: LogLevel, message: string, meta?: unknown): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  const writer = level === "error" ? console.error : console.log;

  if (meta === undefined) {
    writer(line);
    return;
  }

  writer(line, meta);
}
