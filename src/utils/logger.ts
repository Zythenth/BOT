import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

type LogLevel = "info" | "warn" | "error";

export interface CommandLogContext {
  commandName: string;
  commandType: "slash" | "prefix" | "button" | "system";
  guildId?: string | null;
  userId?: string | null;
}

const SECRET_KEY_PATTERN = /(token|api[_-]?key|secret|password|authorization|discord[_-]?token|giphy[_-]?api[_-]?key)/i;

export const logger = {
  info(message: string, meta?: unknown): void {
    writeLog("info", message, meta);
  },

  warn(message: string, meta?: unknown): void {
    writeLog("warn", message, meta);
  },

  error(message: string, meta?: unknown): void {
    writeLog("error", message, meta);
  },

  command(context: CommandLogContext): void {
    writeLog("info", "Command used.", context);
  }
};

export function sanitizeForLog(value: unknown, options: { includeStack?: boolean } = {}): unknown {
  return sanitizeValue(value, options, new WeakSet<object>());
}

function writeLog(level: LogLevel, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const consoleMeta = meta === undefined
    ? undefined
    : sanitizeForLog(meta, { includeStack: false });
  const technicalMeta = meta === undefined
    ? undefined
    : sanitizeForLog(meta, { includeStack: true });
  const consoleLine = formatLine(timestamp, level, message, consoleMeta);
  const technicalLine = formatLine(timestamp, level, message, technicalMeta);
  const writer = level === "error" ? console.error : console.log;

  writer(consoleLine);
  writePrivateTechnicalLog(technicalLine);
}

function formatLine(
  timestamp: string,
  level: LogLevel,
  message: string,
  meta?: unknown
): string {
  const base = `[${timestamp}] [${level.toUpperCase()}] ${redactString(message)}`;

  if (meta === undefined) {
    return base;
  }

  return `${base} ${safeJsonStringify(meta)}`;
}

function writePrivateTechnicalLog(line: string): void {
  try {
    const technicalLogPath = getTechnicalLogPath();

    mkdirSync(path.dirname(technicalLogPath), { recursive: true });
    appendFileSync(technicalLogPath, `${line}\n`, "utf8");
  } catch {
    // Logging must never break bot execution.
  }
}

function getTechnicalLogPath(): string {
  return process.env.TECHNICAL_LOG_PATH?.trim() ||
    path.resolve(process.cwd(), "logs", "technical.log");
}

function sanitizeValue(
  value: unknown,
  options: { includeStack?: boolean },
  seen: WeakSet<object>
): unknown {
  if (value instanceof Error) {
    return sanitizeError(value, options);
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (seen.has(value)) {
    return "[circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, options, seen));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = SECRET_KEY_PATTERN.test(key)
      ? "[redacted]"
      : sanitizeValue(nestedValue, options, seen);
  }

  return sanitized;
}

function sanitizeError(error: Error, options: { includeStack?: boolean }): Record<string, unknown> {
  return {
    name: error.name,
    message: redactString(error.message),
    stack: options.includeStack ? redactString(error.stack ?? "") : undefined
  };
}

function redactString(value: string): string {
  const secrets = [
    process.env.DISCORD_TOKEN,
    process.env.GIPHY_API_KEY,
    process.env.DATABASE_URL
  ].filter((secret): secret is string => Boolean(secret && secret.length >= 6));

  return secrets.reduce(
    (current, secret) => current.replaceAll(secret, "[redacted]"),
    value
  );
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "\"[unserializable]\"";
  }
}
