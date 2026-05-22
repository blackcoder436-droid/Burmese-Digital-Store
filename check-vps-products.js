const mongoose = require('mongoose');
const connectDB = require('./src/lib/mongodb').default;

async function checkProducts() {
  try {
    await connectDB();
    const Product = mongoose.model('Product');
    
    const allProducts = await Product.find({}, 'name slug category _id').limit(20);
    console.log('All products:');
    allProducts.forEach(p => {
      console.log(`  - ${p.name} (slug: ${p.slug}, category: ${p.category})`);
    });
    
    const vpsProducts = await Product.find({ category: 'vps' }, 'name slug _id');
    console.log(`\nVPS products: ${vpsProducts.length}`);
    vpsProducts.forEach(p => {
      console.log(`  - ${p.name} (_id: ${p._id})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkProducts();
