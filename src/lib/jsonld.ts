// ==========================================
// JSON-LD Structured Data — Burmese Digital Store
// For SEO rich results in Google Search
// ==========================================

/**
 * Organization schema — used on homepage
 */
export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Burmese Digital Store',
    url: 'https://burmesedigital.store',
    logo: 'https://burmesedigital.store/logo.jpg',
    description:
      "Myanmar's trusted digital store for VPN accounts, streaming subscriptions, gaming credits, and more.",
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['my', 'en'],
    },
    sameAs: [
      // Add social profile URLs when available
    ],
  };
}

/**
 * WebSite schema with search action — used on homepage
 */
export function getWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Burmese Digital Store',
    url: 'https://burmesedigital.store',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://burmesedigital.store/shop?search={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Product schema — used on product detail pages
 */
export function getProductJsonLd(product: {
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  inStock: boolean;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image || 'https://burmesedigital.store/logo.jpg',
    url: product.url,
    category: product.category,
    brand: {
      '@type': 'Brand',
      name: 'Burmese Digital Store',
    },
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'MMK',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: product.url,
      seller: {
        '@type': 'Organization',
        name: 'Burmese Digital Store',
      },
    },
  };
}

/**
 * BreadcrumbList schema — used on inner pages
 */
export function getBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * FAQPage schema — useful for VPN/contact pages
 */
export function getFaqJsonLd(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
