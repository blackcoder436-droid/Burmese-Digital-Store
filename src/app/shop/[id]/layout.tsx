import type { Metadata } from 'next';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { getProductJsonLd, getBreadcrumbJsonLd } from '@/lib/jsonld';

interface Props {
  params: Promise<{ id: string }>;
}

// Store product data for both metadata and JSON-LD
let cachedProduct: { name: string; description: string; price: number; image?: string; category: string; stock: number; id: string; slug?: string } | null = null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://burmesedigital.store';

  try {
    await connectDB();
    const isObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
    const query = isObjectId
      ? { _id: id, active: true }
      : { slug: id, active: true };
    const product = await Product.findOne(query)
      .select('name description price category image stock slug')
      .lean();

    if (!product) {
      cachedProduct = null;
      return {
        title: 'Product Not Found',
        description: 'This product could not be found.',
      };
    }

    cachedProduct = {
      name: product.name,
      description: product.description || '',
      price: product.price,
      image: product.image,
      category: product.category,
      stock: product.stock || 0,
      id: String(product._id),
      slug: product.slug,
    };

    const urlId = product.slug || id;
    const title = `${product.name} — ${product.price.toLocaleString()} MMK`;
    const description = product.description?.slice(0, 160) || `Buy ${product.name} at Burmese Digital Store`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${baseUrl}/shop/${urlId}`,
        type: 'website',
        ...(product.image && product.image !== '/images/default-product.png'
          ? { images: [{ url: product.image, width: 600, height: 400, alt: product.name }] }
          : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(product.image && product.image !== '/images/default-product.png'
          ? { images: [product.image] }
          : {}),
      },
      alternates: {
        canonical: `${baseUrl}/shop/${urlId}`,
      },
    };
  } catch {
    cachedProduct = null;
    return {
      title: 'Product',
      description: 'View product details at Burmese Digital Store',
    };
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://burmesedigital.store';

  return (
    <>
      {cachedProduct && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                getProductJsonLd({
                  name: cachedProduct.name,
                  description: cachedProduct.description,
                  price: cachedProduct.price,
                  image: cachedProduct.image,
                  category: cachedProduct.category,
                  inStock: cachedProduct.stock > 0,
                  url: `${baseUrl}/shop/${cachedProduct.slug || cachedProduct.id}`,
                })
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                getBreadcrumbJsonLd([
                  { name: 'Home', url: baseUrl },
                  { name: 'Shop', url: `${baseUrl}/shop` },
                  { name: cachedProduct.name, url: `${baseUrl}/shop/${cachedProduct.slug || cachedProduct.id}` },
                ])
              ),
            }}
          />
        </>
      )}
      {children}
    </>
  );
}
