import fs from 'fs';
let f = JSON.parse(fs.readFileSync('prod_vpn_plans.json', 'utf8'));
let p = fs.readFileSync('price-table.html', 'utf8');

const replacements = [
  ['1 Month', ['4,000 Ks', '5,000 Ks', '6,000 Ks', '7,000 Ks', '8,000 Ks']],
  ['3 Months', ['12,000 Ks', '15,000 Ks', '18,000 Ks', '21,000 Ks', '24,000 Ks']],
  ['5 Months', ['20,000 Ks', '25,000 Ks', '30,000 Ks', '35,000 Ks', '40,000 Ks']],
  ['7 Months', ['28,000 Ks', '35,000 Ks', '42,000 Ks', '49,000 Ks', '56,000 Ks']],
  ['9 Months', ['36,000 Ks', '45,000 Ks', '54,000 Ks', '63,000 Ks', '72,000 Ks']],
  ['12 Months', ['48,000 Ks', '60,000 Ks', '72,000 Ks', '84,000 Ks', '96,000 Ks']]
];

for (const [month, prices] of replacements) {
  const regex = new RegExp(month + '<\\\\/text>[\\\\s\\\\S]*?<\\\\/g>');
  const newMarkup = month + '</text>\\n' +
    '            <text x="220" y="30" class="td" text-anchor="middle">' + prices[0] + '</text>\\n' +
    '            <text x="420" y="30" class="td" text-anchor="middle">' + prices[1] + '</text>\\n' +
    '            <text x="620" y="30" class="td" text-anchor="middle">' + prices[2] + '</text>\\n' +
    '            <text x="820" y="30" class="td" text-anchor="middle">' + prices[3] + '</text>\\n' +
    '            <text x="1020" y="30" class="td" text-anchor="middle">' + prices[4] + '</text>\\n' +
    '          </g>';
  p = p.replace(regex, newMarkup);
}

fs.writeFileSync('price-table.html', p);
console.log('Fixed HTML');
