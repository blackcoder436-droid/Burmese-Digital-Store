import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/init-vps-products' });

/**
 * POST /api/admin/init-vps-products
 * Initialize VPS products in the database
 * This is a one-time setup endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Basic security: check for admin token or API key
    const adminKey = request.headers.get('x-admin-key');
    const envKey = process.env.ADMIN_API_KEY;

    if (!envKey || adminKey !== envKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const vpsProducts = [
      {
        name: 'Cloud VPS - Ubuntu Micro',
        slug: 'ubuntu-micro',
        category: 'vps',
        description: 'Ubuntu 22.04 - 1 vCPU, 2 GB RAM, 50 GB SSD',
        price: 50000,
        image: '/images/vps-default.png',
        stock: 999,
        purchaseDisabled: false,
        details: [], // Empty = manual fulfillment
        active: true,
        featured: false,
      },
      {
        name: 'Cloud VPS - Ubuntu Starter',
        slug: 'ubuntu-starter',
        category: 'vps',
        description: 'Ubuntu 22.04 - 2 vCPU, 2 GB RAM, 60 GB SSD',
        price: 70000,
        image: '/images/vps-default.png',
        stock: 999,
        purchaseDisabled: false,
        details: [],
        active: true,
        featured: false,
      },
      {
        name: 'Cloud VPS - Ubuntu Pro',
        slug: 'ubuntu-pro',
        category: 'vps',
        description: 'Ubuntu 22.04 - 2 vCPU, 4 GB RAM, 80 GB SSD',
        price: 100000,
        image: '/images/vps-default.png',
        stock: 999,
        purchaseDisabled: false,
        details: [],
        active: true,
        featured: true,
      },
      {
        name: 'Cloud VPS - Ubuntu Premium',
        slug: 'ubuntu-premium',
        category: 'vps',
        description: 'Ubuntu 22.04 - 4 vCPU, 8 GB RAM, 160 GB SSD',
        price: 130000,
        image: '/images/vps-default.png',
        stock: 999,
        purchaseDisabled: false,
        details: [],
        active: true,
        featured: false,
      },
    ];

    // Upsert VPS products
    const results = await Promise.all(
      vpsProducts.map((product) =>
        Product.updateOne(
          { slug: product.slug },
          product,
          { upsert: true }
        )
      )
    );

    log.info('VPS products initialized', {
      upsertedCount: results.filter((r) => r.upsertedId).length,
      modifiedCount: results.filter((r) => r.modifiedCount > 0).length,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'VPS products initialized',
        results: results.map((r) => ({
          upserted: !!r.upsertedId,
          modified: r.modifiedCount > 0,
        })),
      },
    });
  } catch (error: unknown) {
    log.error('VPS products init error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
