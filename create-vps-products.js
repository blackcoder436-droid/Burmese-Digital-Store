const mongoose = require('mongoose');

async function createVpsProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burmese-digital-store');
    
    const db = mongoose.connection;
    const productsCollection = db.collection('products');
    
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
        createdAt: new Date(),
        updatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Delete existing VPS products with same names
    await productsCollection.deleteMany({ category: 'vps' });
    console.log('Deleted existing VPS products');

    const result = await productsCollection.insertMany(vpsProducts);
    console.log(`Created ${result.insertedCount} VPS products:`);
    Object.entries(result.insertedIds).forEach(([idx, id]) => {
      console.log(`  - ${vpsProducts[Number(idx)].name} (ID: ${id})`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createVpsProducts();
