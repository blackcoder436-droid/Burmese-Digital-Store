import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { uploadLimiter } from '@/lib/rateLimit';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  validateImageUpload,
  safeExtension,
  isPathWithinDir,
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_SIZE,
} from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/auth/avatar' });

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');
const AVATAR_SIZE = 256; // Resize to 256x256

// POST /api/auth/avatar - Upload avatar
export async function POST(request: NextRequest) {
  // Rate limit: max 10 uploads per minute
  const limited = await uploadLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Guard against oversized request body (double-check beyond formData parser)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_AVATAR_SIZE + 1024) {
      return NextResponse.json(
        { success: false, error: 'Request too large' },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file into buffer for deep validation
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    // Comprehensive validation: size, MIME, magic bytes, suspicious content
    const validationError = validateImageUpload(file, rawBuffer, {
      maxSize: MAX_AVATAR_SIZE,
      allowedTypes: ALLOWED_IMAGE_TYPES,
    });
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // Re-encode image with sharp — strips EXIF/metadata, neutralizes polyglot payloads
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(rawBuffer)
        .rotate() // Auto-orient from EXIF, then EXIF is stripped on re-encode
        .resize(AVATAR_SIZE, AVATAR_SIZE, {
          fit: 'cover',
          position: 'centre',
        })
        .jpeg({ quality: 85 }) // Always output as JPEG for consistency & safety
        .toBuffer();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid or corrupted image file' },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete old avatar file — with path traversal protection
    if (user.avatar) {
      const oldPath = path.join(process.cwd(), 'public', user.avatar);
      if (isPathWithinDir(oldPath, UPLOAD_DIR)) {
        try {
          await unlink(oldPath);
        } catch {
          // Old file may not exist, ignore
        }
      }
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Safe filename: userId + timestamp + always .jpg (never from user input)
    const filename = `${authUser.userId}-${Date.now()}.jpg`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Final path safety check
    if (!isPathWithinDir(filePath, UPLOAD_DIR)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    await writeFile(filePath, processedBuffer);

    // Update user avatar path
    const avatarUrl = `/uploads/avatars/${filename}`;
    user.avatar = avatarUrl;
    await user.save();

    return NextResponse.json({
      success: true,
      data: { avatar: avatarUrl },
      message: 'Avatar uploaded successfully',
    });
  } catch (error: unknown) {
    log.error('Avatar upload error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/avatar - Remove avatar
export async function DELETE(request: NextRequest) {
  const limited = await uploadLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await connectDB();
    const user = await User.findById(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete file with path traversal protection
    if (user.avatar) {
      const oldPath = path.join(process.cwd(), 'public', user.avatar);
      if (isPathWithinDir(oldPath, UPLOAD_DIR)) {
        try {
          await unlink(oldPath);
        } catch {
          // File may not exist, ignore
        }
      }
    }

    user.avatar = undefined;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (error: unknown) {
    log.error('Avatar delete error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
