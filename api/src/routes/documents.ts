import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { authenticate, AuthRequest } from '../middleware/auth';
import { DocumentStore } from '../models/store';
import { config } from '../config';
import { checkDocumentQuality } from '../services/qualityService';
import { preprocessDocument } from '../services/preprocessingService';
import {
  extractBatchDocumentFields,
  FileBatchItem,
} from '../services/extractionService';
import {
  normalizeField,
  canonicalFieldKey,
} from '../services/normalizationService';
import { AuditService } from '../services/auditService';
import logger, { logExtractionMetrics } from '../services/logger';
import { maskFields } from '../services/piiMasking';
import { documentRegistry } from '../registry/documentRegistry';
import { redactDocumentImage } from '../services/imageRedaction';

const router = Router();

fs.mkdirSync(config.upload.dir, { recursive: true });

const allowed = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.pdf', 'application/pdf'],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: config.upload.dir,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${uuidv4()}${extension}`);
    },
  }),

  limits: {
    fileSize: config.upload.maxFileSizeMb * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedMimeType = allowed.get(extension);

    callback(null, expectedMimeType === file.mimetype);
  },
});

const safeDelete = (filePath: string): void => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may have already been deleted.
  }
};

function magicMatches(filePath: string, mimeType: string): boolean {
  try {
    const bytes = fs.readFileSync(filePath).subarray(0, 8);

    const isPng = bytes.equals(
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ])
    );

    const isJpeg = bytes
      .subarray(0, 3)
      .equals(Buffer.from([0xff, 0xd8, 0xff]));

    const isPdf = bytes.subarray(0, 5).toString() === '%PDF-';

    return (
      (mimeType === 'image/png' && isPng) ||
      (mimeType === 'image/jpeg' && isJpeg) ||
      (mimeType === 'application/pdf' && isPdf)
    );
  } catch {
    return false;
  }
}

/**
 * Convert inconsistent field names returned by OCR/AI into a
 * predictable format for sensitive-data checking.
 */
function normalizeKeyForMasking(fieldKey: unknown): string {
  return String(fieldKey ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Prepare a document for an API response.
 *
 * Raw values remain available internally for comparison, but Aadhaar/PAN
 * numbers are never returned in full to the browser.
 */
type ApiPurpose = 'display' | 'verification' | 'audit' | 'export';

// Maps the route-level purpose vocabulary onto the masking policy vocabulary.
// Keeping these separate lets the API's public contract stay stable even if
// masking purposes are renamed or added to later.
function toMaskingPurpose(purpose: ApiPurpose): 'internal_review' | 'export_pdf' | 'guidance_link' | 'public_share' {
  switch (purpose) {
    case 'verification': return 'internal_review';
    case 'export': return 'export_pdf';
    case 'audit': return 'internal_review';
    case 'display':
    default: return 'guidance_link';
  }
}

function safeDocument(doc: any, purpose: ApiPurpose = 'display'): any {
  if (!doc) {
    return null;
  }

  const rawFields = (doc.extractedFields || []).map((f: any) => ({
    fieldKey: f.fieldKey,
    value: f.value ?? f.normalized ?? '',
  }));

  const masked = maskFields(doc.docType || 'unknown', rawFields, toMaskingPurpose(purpose));
  const maskedMap: Record<string, string> = {};
  for (const m of masked) maskedMap[m.fieldKey] = m.value;

  return {
    ...doc,
    extractedFields: (doc.extractedFields || []).map((field: any) => ({
      ...field,
      value: maskedMap[field.fieldKey] ?? field.value,
      normalized: maskedMap[field.fieldKey] !== field.value ? '' : field.normalized,
      evidenceText: undefined,
    })),
  };
}

// POST /documents â€” Single-request batch upload and extraction
router.post(
  '/',
  authenticate,
  upload.array('documents', config.upload.maxFiles),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    if (req.header('x-processing-consent') !== 'true') {
      res.status(400).json({
        error: 'Explicit processing consent is required.',
      });
      return;
    }

    const files = req.files as Express.Multer.File[];

    if (!files?.length) {
      res.status(400).json({
        error: 'No documents uploaded',
      });
      return;
    }

    const batchStart = Date.now();

    const validFiles: {
      file: Express.Multer.File;
      index: number;
    }[] = [];

    const responseDocs: unknown[] = [];

    const preprocessResults: {
      index: number;
      pageImages: string[];
      cleanup: () => void;
      processedSizeBytes: number;
    }[] = [];

    // 1. Verify that file contents match the claimed MIME type.
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      if (!magicMatches(file.path, file.mimetype)) {
        safeDelete(file.path);

        responseDocs.push({
          error: `${file.originalname} failed content verification.`,
        });
      } else {
        validFiles.push({
          file,
          index,
        });
      }
    }

    if (validFiles.length === 0) {
      res.status(400).json({
        documents: responseDocs,
      });
      return;
    }

    try {
      // 2. Preprocess all valid images and PDFs in parallel.
      await Promise.all(
        validFiles.map(async ({ file, index }) => {
          const preprocessing = await preprocessDocument(
            file.path,
            file.mimetype
          );

          preprocessResults.push({
            index,
            pageImages: preprocessing.pageImages,
            cleanup: preprocessing.cleanup,
            processedSizeBytes: preprocessing.processedSizeBytes,
          });
        })
      );

      const fileBatchItems: FileBatchItem[] = preprocessResults.map(
        (preprocessing) => ({
          fileIndex: preprocessing.index,
          pageImages: preprocessing.pageImages,
        })
      );

      // 3. Attempt Gemini extraction with the configured fallback.
      const extractionMap =
        await extractBatchDocumentFields(fileBatchItems);

      // 4. Store and normalize each document.
      for (const { file, index } of validFiles) {
        const preprocessing = preprocessResults.find(
          (item) => item.index === index
        );

        const extraction = extractionMap.get(index);

        const doc = DocumentStore.create({
          userId: req.user.id,
          docType: 'unknown',
          title: file.originalname,
          status: 'processing',
          originalFilename: file.originalname,
          storedFilename: file.filename,
          contentType: file.mimetype,
          size: file.size,
          needsReview: false,
        });

        if (!extraction || !preprocessing) {
          DocumentStore.update(doc._id, {
            status: 'failed',
            needsReview: true,
          });

          responseDocs.push(
            safeDocument(DocumentStore.findById(doc._id))
          );

          continue;
        }

        // Check the quality of the first preprocessed page.
        const quality = await checkDocumentQuality(
          preprocessing.pageImages[0],
          'image/jpeg'
        );

        if (quality.status === 'fail') {
          DocumentStore.update(doc._id, {
            quality,
            status: 'failed',
            needsReview: true,
          });

          logExtractionMetrics({
            docId: doc._id,
            status: 'failed',
            inputSizeBytes: file.size,
            timings: {
              totalMs: Date.now() - batchStart,
            },
            fallbackReason: 'quality_check_failed',
          });

          responseDocs.push(
            safeDocument(DocumentStore.findById(doc._id))
          );

          continue;
        }

        const normalizedFields = extraction.fields.map((field) => {
          const fieldKey = canonicalFieldKey(field.fieldKey);
          const normalizedResult = normalizeField(
            fieldKey,
            field.value
          );

          return {
            ...field,
            fieldKey,
            normalized: normalizedResult.normalized,
            incomplete: normalizedResult.incomplete,
            invalidReason:
              field.confidence < 0.6 ||
                !normalizedResult.normalized
                ? 'low_confidence_or_invalid_value'
                : null,
          };
        });

        const totalMs = Date.now() - batchStart;
        const hasExtractedFields = normalizedFields.length > 0;

        /*
         * A document must not be marked ready when OCR/AI returned
         * no usable fields.
         */
        const finalStatus = hasExtractedFields
          ? 'ready'
          : 'failed';

        DocumentStore.update(doc._id, {
          quality,
          docType: extraction.docType,

          title:
            extraction.docType === 'unknown'
              ? doc.title
              : extraction.docType
                .replace(/_/g, ' ')
                .toUpperCase(),

          status: finalStatus,
          extractedFields: normalizedFields,
          ocrBoxes: extraction.boxes || [],

          needsReview:
            !hasExtractedFields ||
            extraction.needsReview ||
            quality.status === 'warn',
        });

        AuditService.log(
          req.user.id,
          'document.extracted',
          {
            docId: doc._id,
            docType: extraction.docType,
            fieldCount: normalizedFields.length,
            usedFallback: extraction.usedFallback,
            status: finalStatus,
            totalMs,
          }
        );

        logExtractionMetrics({
          docId: doc._id,
          docType: extraction.docType,
          status: finalStatus,
          inputSizeBytes: file.size,
          processedSizeBytes:
            preprocessing.processedSizeBytes,

          timings: {
            geminiMs: extraction.geminiMs,
            validationMs: extraction.validationMs,
            paddleMs: extraction.paddleMs,
            totalMs,
          },

          fallbackReason: extraction.fallbackReason,
          fieldCount: normalizedFields.length,
        });

        responseDocs.push(
          safeDocument(DocumentStore.findById(doc._id))
        );
      }
    } catch (error) {
      logger.error(
        '[Documents API] Batch document extraction error:',
        error
      );
    } finally {
      // Delete temporary preprocessed pages.
      for (const preprocessing of preprocessResults) {
        preprocessing.cleanup();
      }

      // Delete original uploaded files after processing.
      for (const { file } of validFiles) {
        safeDelete(file.path);
      }
    }

    res.status(201).json({
      documents: responseDocs,
    });
  }
);

router.get(
  '/',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const documents = DocumentStore.findByUser(req.user.id)
      .map((d) => safeDocument(d));

    res.json({
      documents,
    });
  }
);

router.get(
  '/:id',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const doc = DocumentStore.findById(req.params.id);

    if (!doc || doc.userId !== req.user.id) {
      res.status(404).json({
        error: 'Document not found',
      });
      return;
    }

    res.json({
      document: safeDocument(doc),
    });
  }
);

router.delete(
  '/:id',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const doc = DocumentStore.findById(req.params.id);

    if (!doc || doc.userId !== req.user.id) {
      res.status(404).json({
        error: 'Document not found',
      });
      return;
    }

    safeDelete(
      path.join(config.upload.dir, doc.storedFilename)
    );

    DocumentStore.delete(doc._id);

    AuditService.log(
      req.user.id,
      'document.deleted',
      {
        docId: doc._id,
      }
    );

    res.status(204).send();
  }
);

router.get(
  '/:id/image',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const doc = DocumentStore.findById(req.params.id);
    if (!doc || doc.userId !== req.user.id) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const purpose = ((req.query.purpose as string) || 'display') as
      | 'display'
      | 'verification'
      | 'audit'
      | 'export';

    const filePath = path.join(config.upload.dir, doc.storedFilename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    try {
      const original = fs.readFileSync(filePath);

      const presentFieldKeys = (doc.extractedFields || []).map((f: any) => f.fieldKey);

      // Match stored OCR boxes to field keys by text containment, then hand
      // off to redactDocumentImage, which itself decides what is sensitive
      // (via documentRegistry) and logs + refuses to certify as fully
      // redacted if any sensitive field has no matching box.
      const fieldBoxes = (doc.ocrBoxes || [])
        .map((b: any) => {
          const match = (doc.extractedFields || []).find(
            (f: any) => f.value && b.text && b.text.includes(f.value)
          );
          return match ? { fieldKey: match.fieldKey, x: b.x, y: b.y, width: b.width, height: b.height } : null;
        })
        .filter((b: any): b is { fieldKey: string; x: number; y: number; width: number; height: number } => b !== null);

      const redaction = await redactDocumentImage(original, doc.docType || 'unknown', presentFieldKeys, fieldBoxes);
      const output = redaction.buffer;

      res.setHeader('Content-Type', doc.contentType || 'image/jpeg');
      res.send(output);
    } catch (err) {
      logger.error('[Documents] Image redaction failed:', err);
      res.status(500).json({ error: 'Failed to load image' });
    }
  }
);

export default router;



