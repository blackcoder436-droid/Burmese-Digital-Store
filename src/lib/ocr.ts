import Tesseract from 'tesseract.js';
import { OCRResult } from '@/types';
import { createLogger } from '@/lib/logger';

const log = createLogger({ module: 'ocr' });

// ==========================================
// OCR Payment Verification - Burmese Digital Store
// Extracts Transaction ID & Amount from Kpay/Wave screenshots
// ==========================================

/** OCR language(s) — configurable via OCR_LANGUAGE env var. Default: 'eng' */
const OCR_LANGUAGE = process.env.OCR_LANGUAGE || 'eng';

/**
 * Extract transaction details from a payment screenshot
 * Supports: Kpay, WaveMoney, UAB Pay, AYA Pay
 */
export async function extractPaymentInfo(imagePath: string): Promise<OCRResult> {
  try {
    const result = await Tesseract.recognize(imagePath, OCR_LANGUAGE, {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          log.debug(`OCR Progress: ${Math.round(info.progress * 100)}%`);
        }
      },
    });

    const rawText = result.data.text;
    const confidence = result.data.confidence;

    // Extract Transaction ID
    const transactionId = extractTransactionId(rawText);

    // Extract Amount
    const amount = extractAmount(rawText);

    return {
      transactionId,
      amount,
      confidence,
      rawText,
    };
  } catch (error) {
    log.error('OCR extraction failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      transactionId: null,
      amount: null,
      confidence: 0,
      rawText: '',
    };
  }
}

/**
 * Extract Transaction ID from OCR text
 * Handles various formats from Myanmar payment apps
 */
function extractTransactionId(text: string): string | null {
  // Common patterns for Transaction ID in Kpay/WaveMoney
  const patterns = [
    // Kpay: Transaction ID formats
    /(?:transaction\s*(?:id|no|number)?|trans(?:action)?\s*#?|ငွေလွှဲ\s*နံပါတ်)\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
    // WaveMoney: Reference number
    /(?:reference\s*(?:no|number|id)?|ref\s*#?)\s*[:\-]?\s*([A-Z0-9]{6,20})/i,
    // Generic alphanumeric ID patterns (at least 8 chars)
    /\b([A-Z]{2,4}\d{8,16})\b/i,
    // Pure numeric transaction IDs
    /(?:transaction|trans|ref|txn)\s*[:\-]?\s*(\d{8,20})/i,
    // Kpay specific pattern
    /\b(KP\d{10,})\b/i,
    // Wave specific pattern
    /\b(WM\d{10,})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract payment amount from OCR text
 * Handles Myanmar Kyat (MMK/Ks) formats
 */
function extractAmount(text: string): string | null {
  const patterns = [
    // Amount with currency: 5,000 Ks, 5000 MMK, etc.
    /(?:amount|ပမာဏ|total|ငွေပမာဏ)\s*[:\-]?\s*([0-9,]+(?:\.\d{1,2})?)\s*(?:ks|kyat|mmk|ကျပ)/i,
    // Currency before amount
    /(?:ks|mmk|ကျပ)\s*[:\-]?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    // Amount field with number
    /(?:amount|ပမာဏ|total)\s*[:\-]?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    // Standalone large number (likely amount) - at least 3 digits
    /\b(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/,/g, '').trim();
    }
  }

  return null;
}

/**
 * Verify if the extracted amount matches the expected amount
 */
export function verifyAmount(
  extractedAmount: string | null,
  expectedAmount: number,
  tolerance: number = 0
): boolean {
  if (!extractedAmount) return false;
  const extracted = parseFloat(extractedAmount);
  return Math.abs(extracted - expectedAmount) <= tolerance;
}

/**
 * Process payment screenshot and return verification result
 */
export async function verifyPaymentScreenshot(
  imagePath: string,
  expectedAmount: number
): Promise<{
  verified: boolean;
  data: OCRResult;
  amountMatch: boolean;
}> {
  const data = await extractPaymentInfo(imagePath);

  const amountMatch = verifyAmount(data.amount, expectedAmount);

  return {
    verified: data.confidence > 60 && data.transactionId !== null && amountMatch,
    data,
    amountMatch,
  };
}
