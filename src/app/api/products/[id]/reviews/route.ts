import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Review from '@/models/Review';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { createLogger } from '@/lib/logger';
import { apiLimiter } from '@/lib/rateLimit';
import mongoose from 'mongoose';

const logger = createLogger({ route: '/api/products/[id]/reviews' });

// GET /api/products/[id]/reviews — list reviews for a product (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '10'), 50);
    const sort = req.nextUrl.searchParams.get('sort') || 'newest'; // newest, oldest, highest, lowest, helpful

    let sortQuery: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (sort === 'highest') sortQuery = { rating: -1, createdAt: -1 };
    else if (sort === 'lowest') sortQuery = { rating: 1, createdAt: -1 };
    else if (sort === 'helpful') sortQuery = { helpful: -1, createdAt: -1 };

    const [reviews, total] = await Promise.all([
      Review.find({ product: id })
        .sort(sortQuery)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name avatar')
        .lean(),
      Review.countDocuments({ product: id }),
    ]);

    // Rating distribution (1-5 star counts)
    const distribution = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribution) {
      ratingDist[d._id] = d.count;
    }

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        ratingDistribution: ratingDist,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch reviews', { error });
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// POST /api/products/[id]/reviews — create a review (auth required, must have completed order)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await apiLimiter(req);
    if (limited) return limited;

    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const { rating, comment, orderId } = body;

    // Validate inputs
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ success: false, error: 'Rating must be 1-5' }, { status: 400 });
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length < 5 || comment.trim().length > 1000) {
      return NextResponse.json({ success: false, error: 'Comment must be 5-1000 characters' }, { status: 400 });
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ success: false, error: 'Valid order ID required' }, { status: 400 });
    }

    await connectDB();

    // Verify user has a completed order for this product
    const order = await Order.findOne({
      _id: orderId,
      user: auth.userId,
      product: id,
      status: 'completed',
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'You must have a completed order for this product to leave a review' },
        { status: 403 }
      );
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ user: auth.userId, product: id });
    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this product' },
        { status: 409 }
      );
    }

    // Create review
    const review = await Review.create({
      user: auth.userId,
      product: id,
      order: orderId,
      rating,
      comment: comment.trim(),
      verified: true,
    });

    // Update product aggregate ratings
    const stats = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(id, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        reviewCount: stats[0].reviewCount,
      });
    }

    // Populate user for response
    const populated = await Review.findById(review._id).populate('user', 'name avatar').lean();

    logger.info('Review created', { userId: auth.userId, productId: id, rating });

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (error: unknown) {
    // Handle duplicate key (user already reviewed)
    if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) {
      return NextResponse.json(
        { success: false, error: 'You have already reviewed this product' },
        { status: 409 }
      );
    }
    logger.error('Failed to create review', { error });
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
