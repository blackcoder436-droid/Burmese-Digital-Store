import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { extractPaymentInfo } from '@/lib/ocr';
import { getAuthUser } from '@/lib/auth';
import { uploadLimiter } from '@/lib/rateLimit';
import {
  validateImageUpload,
  safeExtension,
  isPathWithinDir,
  ALLOWED_IMAGE_TYPES,
  MAX_SCREENSHOT_SIZE,
} from '@/lib/security';

// POST /api/ocr/verify - Verify payment screenshot with OCR
export async function POST(request: NextRequest) {
  const limited = await uploadLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('screenshot') as File;
    const expectedAmount = parseFloat(formData.get('expectedAmount') as string);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Screenshot file is required' },
        { status: 400 }
      );
    }

    // Validate file: size, MIME, magic bytes, suspicious content
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadError = validateImageUpload(file, fileBuffer, {
      maxSize: MAX_SCREENSHOT_SIZE,
      allowedTypes: ALLOWED_IMAGE_TYPES,
    });
    if (uploadError) {
      return NextResponse.json(
        { success: false, error: uploadError },
        { status: 400 }
      );
    }

    // Save temp file for OCR processing
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    await mkdir(tempDir, { recursive: true });

    const ext = safeExtension(file.type) || 'png';
    const tempFilename = `ocr-${Date.now()}.${ext}`;
    const tempPath = path.join(tempDir, tempFilename);

    // Path safety check
    if (!isPathWithinDir(tempPath, tempDir)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    await writeFile(tempPath, fileBuffer);

    // Run OCR
    const ocrResult = await extractPaymentInfo(tempPath);

    // Check amount match if expected amount provided (with 2% tolerance)
    let amountMatch = false;
    if (expectedAmount && ocrResult.amount) {
      const extracted = parseFloat(ocrResult.amount);
      const tolerance = expectedAmount * 0.02; // 2% tolerance
      amountMatch = Math.abs(extracted - expectedAmount) <= tolerance;
    }

    // Clean up temp file (non-blocking)
    import('fs/promises').then(({ unlink }) => unlink(tempPath).catch(() => {}));

    return NextResponse.json({
      success: true,
      data: {
        transactionId: ocrResult.transactionId,
        amount: ocrResult.amount,
        confidence: ocrResult.confidence,
        amountMatch,
        verified:
          ocrResult.confidence > 60 &&
          ocrResult.transactionId !== null,
      },
    });
  } catch (error: unknown) {
    console.error('OCR verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process screenshot' },
      { status: 500 }
    );
  }
}
