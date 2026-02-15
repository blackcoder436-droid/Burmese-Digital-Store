import path from 'path';

// ==========================================
// Security Utilities - Burmese Digital Store
// Centralized input validation & sanitization
// ==========================================

// --- Magic Bytes (file signature) validation ---
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (must also check for WEBP at offset 8)
};

/**
 * Verify a file's actual type by reading its magic bytes.
 * Returns true only if the binary header matches the claimed MIME type.
 */
export function verifyMagicBytes(
  buffer: Buffer,
  claimedType: string
): boolean {
  const signatures = MAGIC_BYTES[claimedType];
  if (!signatures) return false;

  for (const sig of signatures) {
    if (buffer.length < sig.length) continue;
    const match = sig.every((byte, i) => buffer[i] === byte);
    if (match) {
      // Extra check for WebP: bytes 8-11 must be "WEBP"
      if (claimedType === 'image/webp') {
        if (buffer.length < 12) return false;
        const webp = buffer.slice(8, 12).toString('ascii');
        return webp === 'WEBP';
      }
      return true;
    }
  }
  return false;
}

// --- Safe file extension mapping ---
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Get a safe file extension from a validated MIME type.
 * NEVER trust user-supplied extensions.
 */
export function safeExtension(mimeType: string): string | null {
  return MIME_TO_EXT[mimeType] || null;
}

// --- Path traversal prevention ---
/**
 * Ensure a file path stays within the expected directory.
 * Prevents ../../ attacks on file deletion paths.
 */
export function isPathWithinDir(filePath: string, dir: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(dir);
  return resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir;
}

// --- String sanitization ---
const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/**
 * Escape HTML special characters to prevent stored XSS.
 * Use on all user-supplied strings before saving to DB.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ENTITY_MAP[char] || char);
}

/**
 * Strip all HTML tags from a string.
 */
export function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a user-supplied string: trim, strip tags, escape HTML, remove null bytes.
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';
  return escapeHtml(
    stripTags(
      str
        .trim()
        .replace(/\0/g, '') // Remove null bytes
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars (keep \n \r \t)
    )
  );
}

/**
 * Validate an email address format.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  // RFC-ish check — intentionally strict
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(email) && email.length <= 254;
}

/**
 * Validate a MongoDB ObjectId format.
 */
export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// --- Upload-specific constants ---
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Comprehensive file upload validation.
 * Returns an error string or null if valid.
 */
export function validateImageUpload(
  file: File,
  buffer: Buffer,
  options: { maxSize: number; allowedTypes: string[] }
): string | null {
  // 1. Check file exists and has content
  if (!file || buffer.length === 0) {
    return 'Empty file';
  }

  // 2. Check file size
  if (buffer.length > options.maxSize) {
    return `File too large. Max ${Math.round(options.maxSize / 1024 / 1024)}MB allowed`;
  }

  // 3. Check claimed MIME type
  if (!options.allowedTypes.includes(file.type)) {
    return 'Invalid file type';
  }

  // 4. Verify magic bytes match claimed type (prevents MIME spoofing)
  if (!verifyMagicBytes(buffer, file.type)) {
    return 'File content does not match its type';
  }

  // 5. Check for suspicious content (script tags, PHP, etc. embedded in image)
  const textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 8192));
  const suspiciousPatterns = [
    /<script/i,
    /<?php/i,
    /<\?=/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
  ];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(textContent)) {
      return 'File contains suspicious content';
    }
  }

  return null; // Valid
}
