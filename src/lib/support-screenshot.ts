import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { createLogger } from '@/lib/logger';
import { safeExtension, sanitizeString, verifyMagicBytes } from '@/lib/security';

const log = createLogger({ module: 'support-screenshot' });

export const MAX_SUPPORT_IMAGE_BYTES = 4 * 1024 * 1024;
export const SUPPORT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SUPPORT_OCR_LANGUAGE = process.env.SUPPORT_SCREENSHOT_OCR_LANGUAGE || 'eng';
const SUPPORT_OCR_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.SUPPORT_SCREENSHOT_OCR_TIMEOUT_MS || 10000)
);

const VPN_URI_RE = /\b(?:ss|ssr|vmess|vless|trojan|hysteria2?|tuic):\/\/[^\s"'<>]+/gi;
const SECRET_URL_PARAM_RE = /([?&](?:access_token|token|key|secret)=)[^&\s"'<>]+/gi;
const LONG_SECRET_RE = /\b[A-Za-z0-9+/_=-]{36,}\b/g;
const RELEVANT_SUPPORT_TEXT_RE =
  /hiddify|timeout|time out|connecting|connected|unknown|error|failed|fail|v2ray|v2box|streisand|happ|outline|vpn|vmess|vless|trojan|server|key|subscription|proxy|proxies|ping/i;

export function validateSupportScreenshot(buffer: Buffer, mimeType: string): void {
  if (!SUPPORT_IMAGE_TYPES.has(mimeType)) {
    throw new Error('Only JPG, PNG, or WEBP screenshots are allowed.');
  }

  if (buffer.length <= 0 || buffer.length > MAX_SUPPORT_IMAGE_BYTES) {
    throw new Error('Screenshot must be 4MB or smaller.');
  }

  if (!verifyMagicBytes(buffer, mimeType)) {
    throw new Error('Screenshot file type could not be verified.');
  }
}

function redactScreenshotText(value: string): string {
  return value
    .replace(VPN_URI_RE, '[vpn-link]')
    .replace(SECRET_URL_PARAM_RE, '$1[redacted]')
    .replace(LONG_SECRET_RE, '[token]')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeScreenshotText(rawText: string): string {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => redactScreenshotText(line))
    .map((line) => sanitizeString(line))
    .filter((line) => line.length >= 2 && line.length <= 120);

  const relevant = lines.filter((line) => RELEVANT_SUPPORT_TEXT_RE.test(line));
  const selected = (relevant.length > 0 ? relevant : lines).slice(0, 8);

  return selected.join(' | ').slice(0, 600);
}

async function recognizeWithTimeout(imagePath: string): Promise<string> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<string>((resolve) => {
      timeout = setTimeout(() => resolve(''), SUPPORT_OCR_TIMEOUT_MS);
    });

    const recognizePromise = Tesseract.recognize(imagePath, SUPPORT_OCR_LANGUAGE, {
      logger: () => undefined,
    } as any).then((result) => result.data.text || '');

    return await Promise.race([recognizePromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function extractSupportScreenshotText(
  buffer: Buffer,
  mimeType: string
): Promise<string | undefined> {
  try {
    validateSupportScreenshot(buffer, mimeType);

    const ext = safeExtension(mimeType);
    if (!ext) return undefined;

    const normalized = await sharp(buffer, { limitInputPixels: 12_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .png()
      .toBuffer();

    const tempPath = path.join(os.tmpdir(), `bds-support-${crypto.randomUUID()}.png`);
    await fs.writeFile(tempPath, normalized, { flag: 'wx' });

    try {
      const rawText = await recognizeWithTimeout(tempPath);
      const normalizedText = normalizeScreenshotText(rawText);
      return normalizedText || undefined;
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  } catch (error) {
    log.warn('Support screenshot OCR skipped', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
