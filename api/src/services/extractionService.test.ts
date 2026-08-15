import assert from 'assert';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

import {
  ExtractedDocSchema,
  BatchExtractedDocSchema,
  validateExtractionQuality,
  paddleOCR,
} from './extractionService';

import { preprocessDocument } from './preprocessingService';

async function runExtractionTests(): Promise<void> {
  console.log('--- Running Extraction Schema & Safety Tests ---');

  const aadhaar = ExtractedDocSchema.parse({
    fileIndex: 0,
    docType: 'aadhaar',
    fields: [
      {
        fieldKey: 'aadhaar_number',
        label: 'Aadhaar Number',
        value: '1234 5678 9012',
        confidence: 95,
        page: '1',
      },
      {
        fieldKey: 'full_name',
        label: 'Name',
        value: 'John Doe',
        confidence: 0.9,
      },
    ],
  });

  assert.equal(aadhaar.docType, 'aadhaar');
  assert.equal(aadhaar.fileIndex, 0);
  assert.equal(aadhaar.fields[0].fieldKey, 'aadhaar_no');
  assert.equal(aadhaar.fields[0].confidence, 0.95);
  assert.equal(aadhaar.fields[0].page, 1);
  assert.equal(validateExtractionQuality(aadhaar).valid, true);

  const batch = BatchExtractedDocSchema.parse({
    documents: [
      { fileIndex: 0, docType: 'aadhaar' },
      { fileIndex: 1, docType: 'pan' },
      { fileIndex: 2, docType: 'ration_card' },
    ],
  });

  assert.equal(batch.documents.length, 3);

  const invalidAadhaar = ExtractedDocSchema.parse({
    fileIndex: 0,
    docType: 'aadhaar',
    fields: [
      {
        fieldKey: 'gender',
        label: 'Gender',
        value: 'Male',
        confidence: 0.9,
      },
    ],
  });

  const aadhaarQuality = validateExtractionQuality(invalidAadhaar);
  assert.equal(aadhaarQuality.valid, false);
  assert.equal(aadhaarQuality.reason, 'missing_aadhaar_key_fields');

  for (const alias of [
    'ration_card',
    'ration card',
    'rationcard',
    'pds_card',
    'food_security_card',
    'nfsa_card',
  ]) {
    const parsed = ExtractedDocSchema.parse({
      fileIndex: 0,
      docType: alias,
      fields: [
        {
          fieldKey: 'ration_card_no',
          label: 'Ration Card Number',
          value: 'RC-123456',
          confidence: 0.95,
        },
      ],
    });

    assert.equal(parsed.docType, 'ration_card');
  }

  const rationCard = ExtractedDocSchema.parse({
    fileIndex: 2,
    docType: 'ration_card',
    fields: [
      {
        fieldKey: 'ration_card_no',
        label: 'Ration Card Number',
        value: 'RC-123456',
        confidence: 0.95,
      },
      {
        fieldKey: 'head_of_family_name',
        label: 'Head of Family Name',
        value: 'S. P. Patil',
        confidence: 0.9,
      },
      {
        fieldKey: 'member_name_1',
        label: 'Member Name 1',
        value: 'S. P. Patil',
        confidence: 0.9,
      },
      {
        fieldKey: 'member_age_1',
        label: 'Member Age 1',
        value: '26',
        confidence: 0.9,
      },
    ],
  });

  assert.equal(rationCard.docType, 'ration_card');
  assert.equal(rationCard.fields[0].fieldKey, 'ration_card_number');
  assert.equal(rationCard.fields[1].fieldKey, 'head_of_family_name');
  assert.equal(rationCard.fields[2].fieldKey, 'member_name_1');
  assert.equal(rationCard.fields[3].fieldKey, 'member_age_1');
  assert.equal(validateExtractionQuality(rationCard).valid, true);

  const invalidRationCard = ExtractedDocSchema.parse({
    fileIndex: 0,
    docType: 'ration_card',
    fields: [
      {
        fieldKey: 'gender',
        label: 'Gender',
        value: 'Male',
        confidence: 0.9,
      },
    ],
  });

  const rationQuality = validateExtractionQuality(invalidRationCard);
  assert.equal(rationQuality.valid, false);
  assert.equal(rationQuality.reason, 'missing_ration_card_key_fields');

  const signature = ExtractedDocSchema.parse({
    fileIndex: 0,
    docType: 'driving_licence',
    fields: [
      {
        fieldKey: 'signature',
        label: 'Signature',
        value: 'Detected',
        confidence: 0.9,
      },
    ],
  });

  assert.equal(signature.fields[0].fieldKey, 'signature');

  const testImagePath = path.join(__dirname, 'test_batch_sample.jpg');

  await sharp({
    create: {
      width: 2400,
      height: 1800,
      channels: 3,
      background: {
        r: 255,
        g: 255,
        b: 255,
      },
    },
  })
    .jpeg()
    .toFile(testImagePath);

  try {
    const prepResult = await preprocessDocument(
      testImagePath,
      'image/jpeg'
    );

    assert.equal(prepResult.pageImages.length, 1);

    const metadata = await sharp(
      prepResult.pageImages[0]
    ).metadata();

    assert.ok((metadata.width ?? 0) <= 1500);
    assert.ok((metadata.height ?? 0) <= 1500);

    prepResult.cleanup();
  } finally {
    try {
      fs.unlinkSync(testImagePath);
    } catch {
      // Ignore cleanup failures.
    }
  }

  const ready = await paddleOCR.waitForReady(1000);
  assert.strictEqual(typeof ready, 'boolean');

  console.log('✅ Extraction schema, ration-card and safety tests passed.');
}

runExtractionTests().catch((error) => {
  console.error('❌ Extraction test failed:', error);
  process.exit(1);
});