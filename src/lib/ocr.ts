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
const OCR_LANG_PATH = (process.env.OCR_LANG_PATH || '').trim();
const OCR_MAX_ATTEMPTS = Math.max(1, parseInt(process.env.OCR_MAX_ATTEMPTS || '2', 10));
const OCR_NETWORK_TIMEOUT_MS = Math.max(1000, parseInt(process.env.OCR_NETWORK_TIMEOUT_MS || '5000', 10));
const OCR_RETRY_DELAY_MS = Math.max(0, parseInt(process.env.OCR_RETRY_DELAY_MS || '400', 10));

const FALLBACK_LANG_PATHS = [
  'https://tessdata.projectnaptha.com/4.0.0/',
  'https://tessdata.projectnaptha.com/4.0.0_best/',
  'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best_int/',
  'https://unpkg.com/@tesseract.js-data/',
];

const langPathAvailabilityCache = new Map<string, boolean>();

const EMPTY_OCR_RESULT: OCRResult = {
  transactionId: null,
  amount: null,
  confidence: 0,
  rawText: '',
};

function normalizeLangPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function primaryLanguage(language: string): string {
  const first = language.split('+')[0]?.trim().toLowerCase();
  return first || 'eng';
}

function buildLangPathCandidates(language: string): string[] {
  const primary = primaryLanguage(language);
  const normalizedEnvPath = normalizeLangPath(OCR_LANG_PATH);

  const dynamicDefaults = FALLBACK_LANG_PATHS.map((pathValue) => {
    if (pathValue.endsWith('/@tesseract.js-data/')) {
      return `${pathValue}${primary}/4.0.0_best_int/`;
    }
    return pathValue;
  });

  return unique([normalizedEnvPath, ...dynamicDefaults].filter(Boolean));
}

function buildTrainedDataUrl(langPath: string, language: string): string {
  return `${normalizeLangPath(langPath)}${primaryLanguage(language)}.traineddata.gz`;
}

async function isUrlReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_NETWORK_TIMEOUT_MS);

  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
    if (head.ok) return true;
    if (head.status === 405 || head.status === 403) {
      const range = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
        cache: 'no-store',
      });
      return range.ok || range.status === 206;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isLangPathAvailable(langPath: string, language: string): Promise<boolean> {
  const key = `${langPath}|${primaryLanguage(language)}`;
  const cached = langPathAvailabilityCache.get(key);
  if (typeof cached === 'boolean') return cached;

  const reachable = await isUrlReachable(buildTrainedDataUrl(langPath, language));
  langPathAvailabilityCache.set(key, reachable);
  return reachable;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract transaction details from a payment screenshot
 * Supports: Kpay, WaveMoney, UAB Pay, AYA Pay
 */
export async function extractPaymentInfo(imagePath: string): Promise<OCRResult> {
  const language = OCR_LANGUAGE.trim() || 'eng';
  const langPathCandidates = buildLangPathCandidates(language);
  let hadReachableSource = false;

  for (const langPath of langPathCandidates) {
    if (!(await isLangPathAvailable(langPath, language))) {
      log.warn('OCR langPath unavailable', { candidate: langPath, language });
      continue;
    }

    hadReachableSource = true;
    for (let attempt = 1; attempt <= OCR_MAX_ATTEMPTS; attempt += 1) {
      try {
        const recognizeOptions: Record<string, unknown> = {
          langPath,
          logger: (info: { status?: string; progress?: number }) => {
            if (info.status === 'recognizing text' && typeof info.progress === 'number') {
              log.debug(`OCR Progress: ${Math.round(info.progress * 100)}%`);
            }
          },
          errorHandler: (error: unknown) => {
            log.warn('OCR worker reported error', {
              langPath,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        };

        const result = await Tesseract.recognize(imagePath, language, recognizeOptions as any);

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
        log.error('OCR recognize attempt failed', {
          langPath,
          attempt,
          maxAttempts: OCR_MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : String(error),
        });
        if (attempt < OCR_MAX_ATTEMPTS && OCR_RETRY_DELAY_MS > 0) {
          await sleep(OCR_RETRY_DELAY_MS);
        }
      }
    }
  }

  if (!hadReachableSource) {
    log.error('OCR skipped - no reachable language data source', { language, langPathCandidates });
    return EMPTY_OCR_RESULT;
  }

  log.error('OCR extraction failed after all sources/attempts', { language, langPathCandidates });
  return EMPTY_OCR_RESULT;
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
 * Handles Myanmar Kyat (MMK/Ks) formats from Kpay, WaveMoney, UAB Pay, AYA Pay
 */
function extractAmount(text: string): string | null {
  // Normalize: replace common OCR artifacts
  const normalized = text
    .replace(/[–—−]/g, '-')  // normalize various dash/minus characters
    .replace(/[၀-၉]/g, (ch) => String(ch.charCodeAt(0) - 0x1040))  // Myanmar digits → ASCII
    .replace(/\s+/g, ' ');

  const patterns = [
    // Kpay: "-3,000.00 (Ks)" or "-3,000.00 Ks" — negative amount with (Ks) or Ks
    /[-]\s*([0-9,]+(?:\.\d{1,2})?)\s*(?:\(?\s*(?:ks|kyat|mmk)\s*\)?)/i,
    // Amount with currency after: "5,000 Ks", "5000 MMK", "3,000.00 ကျပ"
    /([0-9,]+(?:\.\d{1,2})?)\s*(?:ks|kyat|mmk|ကျပ)/i,
    // Amount with currency keyword before: "ပမာဏ 5,000", "amount: 3,000"
    /(?:amount|ပမာဏ|total|ငွေပမာဏ|ပေးငွေ|ပမာ)\s*[:\-]?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    // Currency before amount: "Ks 5,000", "MMK 3000"
    /(?:ks|mmk|ကျပ)\s*[:\-]?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    // Wave: "5,000.00 ကျပ" or just number followed by Burmese
    /([0-9,]+(?:\.\d{1,2})?)\s*(?:ကျပ|ks)/i,
    // Kpay negative with .00: "-3,000.00"
    /[-]\s*([0-9,]+\.\d{2})\b/,
    // Standalone formatted number (comma-separated, at least 1,000)
    /\b([0-9]{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/,
    // Standalone number >= 1000 without commas (e.g. "3000", "5000.00")
    /\b([0-9]{4,7}(?:\.\d{1,2})?)\b/,
  ];

  const amounts: number[] = [];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].replace(/,/g, '').trim();
      const value = parseFloat(cleaned);
      if (!isNaN(value) && value >= 500) {
        log.debug('OCR amount candidate', { pattern: pattern.source, raw: match[0], value });
        return cleaned;
      }
    }
  }

  // Fallback: find ALL numbers >= 500 in the text and return the largest
  const allNumbers = normalized.match(/[0-9,]+(?:\.\d{1,2})?/g);
  if (allNumbers) {
    for (const numStr of allNumbers) {
      const value = parseFloat(numStr.replace(/,/g, ''));
      if (!isNaN(value) && value >= 500) {
        amounts.push(value);
      }
    }
    if (amounts.length > 0) {
      // Return the largest amount found (most likely the payment amount)
      const largest = Math.max(...amounts);
      log.debug('OCR amount fallback — largest number', { largest, candidates: amounts });
      return largest.toString();
    }
  }

  log.warn('OCR could not extract amount', { textLength: text.length });
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
  const extracted = parseFloat(extractedAmount.replace(/,/g, ''));
  if (isNaN(extracted)) return false;
  const match = Math.abs(extracted - expectedAmount) <= tolerance;
  log.debug('OCR amount verify', { extracted, expectedAmount, tolerance, match });
  return match;
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
