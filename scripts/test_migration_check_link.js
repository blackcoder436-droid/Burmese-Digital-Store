const http = require('http');
const querystring = require('querystring');

const oldLink = 'https://jan.burmesedigital.store:2096/sub/8c53v41ngpkcv3ma';
const url = 'http://localhost:3000/api/migration/check?key=' + encodeURIComponent(oldLink);

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { console.log(JSON.parse(data)); } catch (e) { console.log(data); }
  });
}).on('error', (err) => {
  console.error('Request error:', err.message);
});
