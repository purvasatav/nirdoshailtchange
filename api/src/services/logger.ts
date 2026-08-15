import fs from 'fs';
import path from 'path';
import winston from 'winston';

const {
  combine,
  timestamp,
  printf,
  colorize,
  errors,
  json,
} = winston.format;

// Custom levels: http sits between info and verbose.
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const SENSITIVE_KEYS = new Set([
  'password',
  'new_password',
  'old_password',
  'confirm_password',
  'password_hash',

  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set_cookie',
  'api_key',
  'gemini_api_key',
  'jwt',
  'secret',

  'aadhaar',
  'aadhaar_no',
  'aadhaar_number',
  'aadhar_no',
  'aadhar_number',
  'uid',
  'uid_number',

  'pan',
  'pan_no',
  'pan_number',

  'passport_no',
  'passport_number',

  'voter_id',
  'epic_no',
  'epic_number',

  'dl_no',
  'licence_number',
  'license_number',

  'ration_card_number',
  'abha_number',
  'uan_number',

  'full_name',
  'father_name',
  'mother_name',
  'guardian_name',
  'head_of_family_name',

  'address',
  'permanent_address',
  'residential_address',

  'ocr_text',
  'raw_ocr_text',
  'raw_response',
  'gemini_response',
  'extracted_fields',
  'document_fields',

  'signature',
  'fingerprint',
  'thumb_impression',
]);

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);

  if (SENSITIVE_KEYS.has(normalized)) {
    return true;
  }

  return (
    normalized.includes('password') ||
    normalized.endsWith('_token') ||
    normalized.endsWith('_secret') ||
    normalized.endsWith('_api_key') ||
    normalized.startsWith('authorization')
  );
}

function sanitizeLogValue(
  value: unknown,
  depth = 0
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Prevent very deeply nested or circular-style structures
  // from overwhelming logs.
  if (depth > 5) {
    return '[MAX_DEPTH]';
  }

  if (typeof value === 'string') {
    const maxLength = 1_000;

    if (value.length > maxLength) {
      return `${value.slice(0, maxLength)}...[TRUNCATED]`;
    }

    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (Array.isArray(value)) {
    const maxArrayItems = 25;

    const sanitized = value
      .slice(0, maxArrayItems)
      .map(item =>
        sanitizeLogValue(item, depth + 1)
      );

    if (value.length > maxArrayItems) {
      sanitized.push(
        `[${value.length - maxArrayItems} more items]`
      );
    }

    return sanitized;
  }

  if (typeof value === 'object') {
    const source =
      value as Record<string, unknown>;

    const sanitized:
      Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(source)) {
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = sanitizeLogValue(
        nestedValue,
        depth + 1
      );
    }

    return sanitized;
  }

  return String(value);
}

/**
 * Sanitizes all structured metadata passed to Winston.
 *
 * Example:
 * logger.info('Document processed', {
 *   documentId,
 *   aadhaarNumber,
 * });
 *
 * Aadhaar values will be redacted automatically.
 */
const sanitizeFormat = winston.format(info => {
  const protectedKeys = new Set([
    'level',
    'message',
    'timestamp',
    'stack',
  ]);

  for (const key of Object.keys(info)) {
    if (protectedKeys.has(key)) {
      continue;
    }

    if (isSensitiveKey(key)) {
      info[key] = '[REDACTED]';
      continue;
    }

    info[key] = sanitizeLogValue(info[key]);
  }

  return info;
});

function stringifyMetadata(
  metadata: Record<string, unknown>
): string {
  const visibleMetadata =
    Object.fromEntries(
      Object.entries(metadata).filter(
        ([key, value]) =>
          value !== undefined &&
          !key.startsWith('Symbol(')
      )
    );

  if (
    Object.keys(visibleMetadata).length === 0
  ) {
    return '';
  }

  try {
    return ` ${JSON.stringify(visibleMetadata)}`;
  } catch {
    return ' [UNSERIALIZABLE_METADATA]';
  }
}

const developmentFormat = combine(
  timestamp({
    format: 'HH:mm:ss',
  }),
  errors({
    stack: true,
  }),
  sanitizeFormat(),
  colorize({
    level: true,
  }),
  printf(info => {
    const {
      level,
      message,
      timestamp: logTimestamp,
      stack,
      ...metadata
    } = info;

    const mainMessage =
      stack || String(message);

    return (
      `${logTimestamp} [${level}]: ${mainMessage}` +
      stringifyMetadata(metadata)
    );
  })
);

const productionFormat = combine(
  timestamp(),
  errors({
    stack: true,
  }),
  sanitizeFormat(),
  json()
);

const isProduction =
  process.env.NODE_ENV === 'production';

const transports:
  winston.transport[] = [
    new winston.transports.Console(),
  ];

/**
 * File logs are optional because services such as Render use
 * ephemeral filesystems. Console logs remain the primary source.
 *
 * To enable:
 * ENABLE_FILE_LOGS=true
 */
if (
  isProduction &&
  process.env.ENABLE_FILE_LOGS === 'true'
) {
  const logsDirectory =
    path.resolve(
      process.cwd(),
      'logs'
    );

  fs.mkdirSync(logsDirectory, {
    recursive: true,
  });

  transports.push(
    new winston.transports.File({
      filename: path.join(
        logsDirectory,
        'error.log'
      ),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),

    new winston.transports.File({
      filename: path.join(
        logsDirectory,
        'combined.log'
      ),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
      tailable: true,
    })
  );
}

const logger = winston.createLogger({
  levels,

  level:
    process.env.LOG_LEVEL ||
    (isProduction ? 'info' : 'http'),

  format: isProduction
    ? productionFormat
    : developmentFormat,

  transports,

  exitOnError: false,
});

export interface ExtractionMetrics {
  docId: string;
  docType?: string;

  status:
  | 'ready'
  | 'failed';

  inputSizeBytes: number;
  processedSizeBytes?: number;

  timings: {
    preprocessMs?: number;
    geminiMs?: number;
    validationMs?: number;
    paddleMs?: number;
    normalizationMs?: number;
    totalMs?: number;
  };

  fallbackReason?: string | null;
  timeoutCount?: number;
  fieldCount?: number;
  usedFallback?: boolean;
}

export function logExtractionMetrics(
  metrics: ExtractionMetrics
): void {
  logger.info(
    '[Extraction Metrics]',
    {
      docId:
        metrics.docId,

      docType:
        metrics.docType ??
        'unknown',

      status:
        metrics.status,

      inputSizeBytes:
        metrics.inputSizeBytes,

      processedSizeBytes:
        metrics.processedSizeBytes ??
        0,

      preprocessMs:
        metrics.timings
          .preprocessMs ??
        0,

      geminiMs:
        metrics.timings
          .geminiMs ??
        0,

      validationMs:
        metrics.timings
          .validationMs ??
        0,

      paddleMs:
        metrics.timings
          .paddleMs ??
        0,

      normalizationMs:
        metrics.timings
          .normalizationMs ??
        0,

      totalMs:
        metrics.timings
          .totalMs ??
        0,

      fallbackReason:
        metrics.fallbackReason ??
        null,

      timeoutCount:
        metrics.timeoutCount ??
        0,

      fieldCount:
        metrics.fieldCount ??
        0,

      usedFallback:
        metrics.usedFallback ??
        false,
    }
  );
}

export default logger;