import fs from 'fs';
let route = fs.readFileSync('src/app/api/vpn/sub/[token]/route.ts', 'utf8');

route = route.replace(
  "if (firstKey.expiryTime && Date.now() > firstKey.expiryTime) {",
  "if ((firstKey as any).expiryTime && Date.now() > (firstKey as any).expiryTime) {"
);

fs.writeFileSync('src/app/api/vpn/sub/[token]/route.ts', route);
console.log('Fixed TS route error');
