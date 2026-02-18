import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { createLogger } from '@/lib/logger';

// ==========================================
// Upload Storage Abstraction
// Burmese Digital Store
//
// Local filesystem by default.
// Set STORAGE_PROVIDER=s3 + S3_* env vars for S3/DO Spaces.
// ==========================================

const log = createLogger({ module: 'storage' });

export interface StorageProvider {
  /** Save a buffer and return the public URL path (e.g. /uploads/avatars/abc.jpg) */
  save(buffer: Buffer, relativePath: string): Promise<string>;
  /** Delete a file by its public URL path */
  delete(relativePath: string): Promise<void>;
  /** Full public URL for a relative path */
  url(relativePath: string): string;
}

// ---- Local Filesystem ----

class LocalStorage implements StorageProvider {
  private root: string;

  constructor(root = path.join(process.cwd(), 'public')) {
    this.root = root;
  }

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const fullPath = path.join(this.root, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    log.info('File saved (local)', { path: relativePath, size: buffer.length });
    return `/${relativePath}`;
  }

  async delete(relativePath: string): Promise<void> {
    const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const fullPath = path.join(this.root, clean);
    try {
      await unlink(fullPath);
      log.info('File deleted (local)', { path: clean });
    } catch (err) {
      log.warn('File delete failed (local)', {
        path: clean,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  url(relativePath: string): string {
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }
}

// ---- Telegram Storage ----
// Stores files via Telegram Bot API (sendDocument/sendPhoto)
// No files stored on server — all data goes to Telegram channel
// Retrieve via getFile() API (URLs expire after ~1hr, re-fetch as needed)

class TelegramStorage implements StorageProvider {
  private botToken: string;
  private channelId: string;
  private apiBase: string;

  // In-memory cache for file URLs (Telegram URLs expire after ~1hr)
  private urlCache = new Map<string, { url: string; expiresAt: number }>();
  private static URL_CACHE_TTL = 50 * 60 * 1000; // 50 minutes (safe margin under 1hr expiry)

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.channelId = process.env.TELEGRAM_CHANNEL_ID || '';
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;

    if (!this.botToken || !this.channelId) {
      throw new Error('Telegram storage requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID env vars');
    }
  }

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const filename = path.basename(relativePath);
    const ext = path.extname(relativePath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

    try {
      const formData = new FormData();
      formData.append('chat_id', this.channelId);

      // Build a safe caption (strip any HTML/script from path)
      const safeCaption = `[Storage] ${relativePath.replace(/[<>&"']/g, '')}`;
      formData.append('caption', safeCaption);

      let data: Record<string, unknown>;

      if (isImage) {
        // Send as photo — Telegram auto-compresses, but we get fast preview
        formData.append('photo', new Blob([new Uint8Array(buffer)]), filename);
        const res = await fetch(`${this.apiBase}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
        data = await res.json();
      } else {
        // Send as document — preserves original file
        formData.append('document', new Blob([new Uint8Array(buffer)]), filename);
        const res = await fetch(`${this.apiBase}/sendDocument`, {
          method: 'POST',
          body: formData,
        });
        data = await res.json();
      }

      if (!data.ok) {
        log.error('Telegram upload failed', { error: (data as Record<string, unknown>).description, path: relativePath });
        throw new Error(`Telegram upload failed: ${(data as Record<string, unknown>).description}`);
      }

      const result = data.result as Record<string, unknown>;
      let fileId: string;

      if (isImage && Array.isArray(result.photo)) {
        // Get largest photo variant (last in array)
        const photos = result.photo as Array<{ file_id: string }>;
        fileId = photos[photos.length - 1].file_id;
      } else if (result.document) {
        fileId = (result.document as { file_id: string }).file_id;
      } else {
        throw new Error('Unexpected Telegram response — no file_id found');
      }

      // Return a telegram:// URI scheme for internal tracking
      // Format: telegram://<fileId>
      const storageUri = `telegram://${fileId}`;

      log.info('File saved (Telegram)', {
        path: relativePath,
        size: buffer.length,
        fileId,
        messageId: result.message_id,
      });

      return storageUri;
    } catch (error) {
      log.error('Telegram upload error', {
        path: relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async delete(relativePath: string): Promise<void> {
    // Telegram doesn't have a delete-file API for bots
    // We can delete the message from the channel instead
    const fileId = this.extractFileId(relativePath);
    if (fileId) {
      this.urlCache.delete(fileId);
    }
    log.info('File delete requested (Telegram) — messages are retained in channel', { path: relativePath });
  }

  url(relativePath: string): string {
    // For telegram:// URIs, return as-is (resolved at serve-time via resolveUrl)
    if (relativePath.startsWith('telegram://')) {
      return relativePath;
    }
    return relativePath;
  }

  /**
   * Resolve a telegram:// URI to a real download URL.
   * Caches results for 50 minutes (Telegram URLs expire after ~1hr).
   */
  async resolveUrl(telegramUri: string): Promise<string | null> {
    const fileId = this.extractFileId(telegramUri);
    if (!fileId) return null;

    // Check cache first
    const cached = this.urlCache.get(fileId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }

    try {
      const res = await fetch(`${this.apiBase}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      });

      const data = await res.json();
      if (!data.ok) {
        log.warn('Telegram getFile failed', { fileId, error: data.description });
        return null;
      }

      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${data.result.file_path}`;

      // Cache the URL
      this.urlCache.set(fileId, {
        url: downloadUrl,
        expiresAt: Date.now() + TelegramStorage.URL_CACHE_TTL,
      });

      return downloadUrl;
    } catch (error) {
      log.error('Telegram getFile error', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private extractFileId(uri: string): string | null {
    if (uri.startsWith('telegram://')) {
      return uri.slice('telegram://'.length);
    }
    return uri;
  }
}

// ---- S3 / DO Spaces ----

class S3Storage implements StorageProvider {
  private bucket: string;
  private region: string;
  private endpoint: string;
  private accessKey: string;
  private secretKey: string;
  private cdnUrl: string;
  private client: unknown;

  constructor() {
    this.bucket = process.env.S3_BUCKET || '';
    this.region = process.env.S3_REGION || 'us-east-1';
    this.endpoint = process.env.S3_ENDPOINT || '';
    this.accessKey = process.env.S3_ACCESS_KEY || '';
    this.secretKey = process.env.S3_SECRET_KEY || '';
    this.cdnUrl = process.env.S3_CDN_URL || '';

    if (!this.bucket || !this.accessKey || !this.secretKey) {
      throw new Error('S3 storage requires S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY env vars');
    }

    // Create S3 client once in constructor (not per-request)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { S3Client } = require('@aws-sdk/client-s3');
      this.client = new S3Client({
        region: this.region,
        ...(this.endpoint && { endpoint: this.endpoint, forcePathStyle: false }),
        credentials: { accessKeyId: this.accessKey, secretAccessKey: this.secretKey },
      });
    } catch {
      throw new Error('S3 storage requires @aws-sdk/client-s3 — run: npm install @aws-sdk/client-s3');
    }
  }

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PutObjectCommand } = require('@aws-sdk/client-s3');

    const ext = path.extname(relativePath).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

    await (this.client as { send: (cmd: unknown) => Promise<void> }).send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: relativePath,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      })
    );

    log.info('File saved (S3)', { path: relativePath, size: buffer.length });
    return this.url(relativePath);
  }

  async delete(relativePath: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

    const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    try {
      await (this.client as { send: (cmd: unknown) => Promise<void> }).send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: clean })
      );
      log.info('File deleted (S3)', { path: clean });
    } catch (err) {
      log.warn('File delete failed (S3)', {
        path: clean,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  url(relativePath: string): string {
    const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    if (this.cdnUrl) return `${this.cdnUrl}/${clean}`;
    if (this.endpoint) return `${this.endpoint}/${this.bucket}/${clean}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${clean}`;
  }
}

// ---- Factory ----

let _instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (_instance) return _instance;

  const provider = process.env.STORAGE_PROVIDER || 'local';

  switch (provider) {
    case 'telegram':
      _instance = new TelegramStorage();
      break;
    case 's3':
      _instance = new S3Storage();
      break;
    case 'local':
    default:
      _instance = new LocalStorage();
      break;
  }

  log.info('Storage provider initialized', { provider });
  return _instance;
}

/**
 * Resolve a storage URL to an accessible download URL.
 * For telegram:// URIs, fetches a fresh URL from Telegram API.
 * For other providers, returns the URL as-is.
 */
export async function resolveStorageUrl(url: string): Promise<string> {
  if (url.startsWith('telegram://')) {
    const storage = getStorage();
    if (storage instanceof TelegramStorage) {
      const resolved = await storage.resolveUrl(url);
      return resolved || url;
    }
  }
  return url;
}

export default getStorage;
