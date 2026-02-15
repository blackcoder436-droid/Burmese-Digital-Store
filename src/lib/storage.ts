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

// ---- S3 / DO Spaces ----

class S3Storage implements StorageProvider {
  private bucket: string;
  private region: string;
  private endpoint: string;
  private accessKey: string;
  private secretKey: string;
  private cdnUrl: string;

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
  }

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    // Dynamic import — @aws-sdk/client-s3 is only needed when S3 provider is active
    // Install: npm install @aws-sdk/client-s3
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: this.region,
      ...(this.endpoint && { endpoint: this.endpoint, forcePathStyle: false }),
      credentials: { accessKeyId: this.accessKey, secretAccessKey: this.secretKey },
    });

    const ext = path.extname(relativePath).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

    await client.send(
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
    const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: this.region,
      ...(this.endpoint && { endpoint: this.endpoint, forcePathStyle: false }),
      credentials: { accessKeyId: this.accessKey, secretAccessKey: this.secretKey },
    });

    const clean = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    try {
      await client.send(
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

export default getStorage;
