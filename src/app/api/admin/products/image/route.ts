import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { uploadLimiter } from '@/lib/rateLimit';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  validateImageUpload,
  safeExtension,
  ALLOWED_IMAGE_TYPES,
} from '@/lib/security';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_WIDTH = 600;
const IMAGE_HEIGHT = 400;

// POST /api/admin/products/image - Upload product image
export async function POST(request: NextRequest) {
  const limited = await uploadLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();

    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PRODUCT_IMAGE_SIZE + 1024) {
      return NextResponse.json(
        { success: false, error: 'Request too large' },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image (type, size, magic bytes, suspicious content)
    const validationError = validateImageUpload(file, buffer, {
      maxSize: MAX_PRODUCT_IMAGE_SIZE,
      allowedTypes: ALLOWED_IMAGE_TYPES,
    });

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const ext = safeExtension(file.type) || 'jpg';
    const filename = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Resize and optimize
    const optimized = await sharp(buffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const finalFilename = filename.replace(/\.\w+$/, '.jpg');
    const filePath = path.join(UPLOAD_DIR, finalFilename);
    await writeFile(filePath, optimized);

    const imageUrl = `/uploads/products/${finalFilename}`;

    return NextResponse.json({
      success: true,
      data: { image: imageUrl },
      message: 'Image uploaded successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    console.error('Product image upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
