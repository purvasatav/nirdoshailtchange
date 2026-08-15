import { Request } from 'express';
import { AuditStore } from '../models/store';
import logger from './logger';

const SENSITIVE_KEYS = new Set([
  'aadhaar',
  'aadhaar_no',
  'aadhaar_number',
  'pan',
  'pan_no',
  'pan_number',
  'passport_no',
  'passport_number',
  'voter_id',
  'epic_no',
  'dl_no',
  'license_number',
  'licence_number',
  'ration_card_number',
  'abha_number',
  'uan_number',

  'full_name',
  'name',
  'father_name',
  'mother_name',
  'guardian_name',
  'head_of_family_name',

  'address',
  'permanent_address',
  'residential_address',

  'fields',
  'ocrText',
  'ocr_text',
  'geminiResponse',
  'rawResponse',
  'signature',
  'fingerprint',
]);

function sanitizeMeta(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();

    if (SENSITIVE_KEYS.has(lower)) {
      safe[key] = '[REDACTED]';
      continue;
    }

    // Avoid logging very large objects
    if (typeof value === 'string' && value.length > 300) {
      safe[key] = `${value.substring(0, 300)}...`;
      continue;
    }

    if (Array.isArray(value)) {
      safe[key] = `[Array(${value.length})]`;
      continue;
    }

    if (
      value &&
      typeof value === 'object'
    ) {
      safe[key] = '[Object]';
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

function normalizeEvent(event: string): string {
  return event
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.');
}

function getClientIp(req?: Request): string {
  if (!req) return 'unknown';

  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  return (
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

export const AuditService = {
  log(
    userId: string,
    event: string,
    meta: Record<string, unknown> = {},
    req?: Request
  ) {
    const safeMeta = sanitizeMeta(meta);

    const auditEntry = AuditStore.add({
      userId,
      event: normalizeEvent(event),
      meta: {
        ...safeMeta,
        timestamp: new Date().toISOString(),
        ip: getClientIp(req),
        userAgent:
          req?.headers['user-agent'] || 'unknown',
      },
    });

    logger.info(
      `[AUDIT] ${normalizeEvent(event)}`,
      {
        userId,
        ...safeMeta,
      }
    );

    return auditEntry;
  },
};