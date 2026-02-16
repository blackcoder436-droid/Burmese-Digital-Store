import path from 'path';
import net from 'net';

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

// --- SSRF / URL validation ---

const DEFAULT_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '169.254.169.254',
  'metadata.google.internal',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const ipVersion = net.isIP(ip);
  if (ipVersion === 4) return isPrivateIpv4(ip);
  if (ipVersion === 6) return isPrivateIpv6(ip);
  return false;
}

export function parseUrlSafe(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function hostnameMatchesAllowlist(hostname: string, allowlist: string[]): boolean {
  const h = hostname.toLowerCase();
  for (const entryRaw of allowlist) {
    const entry = entryRaw.trim().toLowerCase();
    if (!entry) continue;

    // Support patterns:
    // - exact host: example.com
    // - suffix: .example.com (matches subdomains only)
    // - wildcard: *.example.com (matches subdomains only)
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1); // ".example.com"
      if (h.endsWith(suffix) && h !== suffix.slice(1)) return true;
      continue;
    }
    if (entry.startsWith('.')) {
      const suffix = entry;
      if (h.endsWith(suffix) && h !== suffix.slice(1)) return true;
      continue;
    }

    if (h === entry) return true;
    if (h.endsWith(`.${entry}`)) return true;
  }
  return false;
}

export function validateExternalHttpUrl(rawUrl: string, opts?: {
  allowHttpInProd?: boolean;
  requiredAllowlistEnv?: string;
}): { ok: true; url: URL } | { ok: false; error: string } {
  const parsed = parseUrlSafe(rawUrl);
  if (!parsed) return { ok: false, error: 'Invalid URL format' };

  const allowHttpInProd = opts?.allowHttpInProd === true;
  const proto = parsed.protocol;
  if (proto !== 'https:' && proto !== 'http:') {
    return { ok: false, error: 'URL must use http or https' };
  }
  if (process.env.NODE_ENV === 'production' && proto === 'http:' && !allowHttpInProd) {
    return { ok: false, error: 'URL must use https in production' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (DEFAULT_BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, error: 'URL hostname is not allowed' };
  }

  // Block obvious private-network IP literals
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    return { ok: false, error: 'URL must not point to private/internal IPs' };
  }

  // Optional allowlist gating
  const envName = opts?.requiredAllowlistEnv || 'VPN_SERVER_ALLOWED_HOSTS';
  const allowlistRaw = (process.env[envName] || '').trim();
  if (allowlistRaw) {
    const allowlist = allowlistRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (allowlist.length > 0 && !hostnameMatchesAllowlist(hostname, allowlist)) {
      return { ok: false, error: `URL hostname is not in allowlist (${envName})` };
    }
  }

  return { ok: true, url: parsed };
}

export function validatePanelPath(panelPath: string): boolean {
  if (typeof panelPath !== 'string') return false;
  const p = panelPath.trim();
  if (!p.startsWith('/')) return false;
  if (p.includes('..')) return false;
  if (p.includes('\\')) return false;
  if (p.includes('://')) return false;
  return p.length <= 100;
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
