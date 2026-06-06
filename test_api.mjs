fetch('https://burmesedigital.store/api/products')
  .then(res => res.json())
  .then(data => {
    const p = data.products.find(x => x.name.toLowerCase().includes('symfony'));
    console.log(p.image);
    console.log(p);
  }).catch(console.error);