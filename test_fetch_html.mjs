fetch('https://burmesedigital.store/shop')
  .then(res => res.text())
  .then(text => {
    const matches = text.match(/src="[^"]*symfony[^"]*"/gi);
    console.log(matches);
  });