# Roadmap Features — Change Summary

This document covers three additions responding to jury feedback: a canonical
identity schema with a document-type registry, purpose-based PII masking, and
image-level redaction. All three are implemented as fresh code in api/src/,
not patches on prior work.

## 1. Canonical Identity Schema / Document Type Registry

**What changed:**
- api/src/types/piiTypes.ts — shared vocabulary (Sensitivity, MaskingPurpose,
  field/document type definitions)
- api/src/data/document-registry.json — single JSON file listing every
  supported document type (aadhaar, pan, birth_certificate,
  domicile_certificate, caste_certificate, income_certificate,
  educational_certificate), each with its fields and per-field sensitivity
- api/src/registry/documentRegistry.ts — reads the JSON, exposes lookups
  (listDocTypes, getSensitivity, getComparisonFields)

**Why:**
Nirdosh Vault needed to expand from Aadhaar/PAN to domicile, caste, income,
and educational certificates without hardcoding a new engine per document
type. Structure and sensitivity now live in one JSON file. Adding a new
document type in the future means adding one entry to
document-registry.json — no new adapter class, no changes to the masking or
redaction engines.

## 2. PII Classification + Purpose-Based Masking

**What changed:**
- api/src/services/piiMasking.ts — maskFields() applies a masking policy
  based on (a) a field's sensitivity, looked up from the registry, and
  (b) the purpose the data is being used for

**Why:**
Aadhaar/PAN numbers were the only fields previously treated as sensitive.
Name, DOB, address, and phone had no sensitivity handling. Every field
across every document type is now classified as public, pii, or critical,
and masking behavior changes by purpose:
- internal_review / export_pdf: PII shown in full, critical fields
  partially masked (last 4 characters visible)
- guidance_link: PII partially masked, critical fields fully masked
- public_share: everything except public fields fully masked

Wired into the existing safeDocument() response-shaping function in
api/src/routes/documents.ts, so every document API response is masked
according to the requested purpose.

## 3. Image-Level Redaction

**What changed:**
- api/src/services/imageRedaction.ts — redactDocumentImage() draws opaque
  black boxes over sensitive-field regions directly on the source document
  image, using sharp

**Why:**
Masking the extracted JSON is not sufficient if the underlying photocopy
image still shows a readable Aadhaar number. This service consumes the same
document-registry.json sensitivity data as the masking service, so a field
marked critical or pii is treated consistently whether it appears in a JSON
response or an image.

Wired into the GET /:id/image route in api/src/routes/documents.ts. Stored
OCR bounding boxes are matched to extracted field keys, then redacted before
the image is served.

**Known limitation, stated plainly:**
Redaction depends on OCR bounding boxes being available and correctly
matched to field values. If a document's OCR pass didn't capture a box for
a sensitive field, redactDocumentImage() logs a warning and reports that
field as skipped rather than silently treating the image as fully redacted
— callers can check this via isFullyRedacted() before serving a derivative
in a lower-trust context. Box-to-field matching currently uses substring
containment on OCR text, which can mismatch when two fields share
overlapping values; this is a known heuristic, not a guarantee.

## Verification performed

- npx tsc --noEmit passes clean across the full api/ project
- Registry lookups tested directly: correct sensitivity returned for known
  fields across multiple document types (e.g. domicile_certificate/reg_no
  -> critical, domicile_certificate/domicile_state -> public)
- Masking tested directly with real field values: same Aadhaar number
  produced different masked output for different purposes (internal_review
  vs public_share), confirmed against actual command output, not just a
  clean compile
- Not yet verified: the image redaction path has not been exercised against
  a live document upload end-to-end; only compiles clean and passes
  isolated logic checks
