import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/products' });

// GET /api/products - List products (public)
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search')?.trim();
    const sortBy = searchParams.get('sort') || 'newest'; // newest, price_asc, price_desc, name
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50);

    // Build query
    const query: Record<string, unknown> = { active: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    // Search: try $text first, fallback to regex for partial matches
    if (search && search.length > 0) {
      // Sanitize search input for regex safety
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice && !isNaN(Number(minPrice))) priceFilter.$gte = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) priceFilter.$lte = Number(maxPrice);
      if (Object.keys(priceFilter).length > 0) {
        query.price = priceFilter;
      }
    }

    // Build sort
    let sort: Record<string, 1 | -1> = { featured: -1, createdAt: -1 };
    switch (sortBy) {
      case 'price_asc':
        sort = { price: 1, createdAt: -1 };
        break;
      case 'price_desc':
        sort = { price: -1, createdAt: -1 };
        break;
      case 'name':
        sort = { name: 1 };
        break;
      case 'newest':
      default:
        sort = { featured: -1, createdAt: -1 };
        break;
    }

    const skip = (page - 1) * limit;

    // Also get distinct categories for filter counts
    const [products, total, categories] = await Promise.all([
      Product.find(query)
        .select('-details')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Product.aggregate([
        { $match: { active: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        products,
        categories: categories.map((c: { _id: string; count: number }) => ({
          value: c._id,
          count: c.count,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: unknown) {
    log.error('Products GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
