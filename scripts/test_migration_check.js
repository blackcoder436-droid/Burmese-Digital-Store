const http = require('http');

const url = 'http://localhost:3000/api/migration/check?key=a07e8b706515f93f2d91bb11d1686bdf';

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
