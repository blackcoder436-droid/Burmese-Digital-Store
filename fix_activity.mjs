import fs from 'fs';
let routeStr = fs.readFileSync('src/app/api/admin/vpn-keys/create/route.ts', 'utf8');

routeStr = routeStr.replace(
  "admin: ((user as any).id || 'unknown').toString(),",
  "admin: (user as any).id,"
);

fs.writeFileSync('src/app/api/admin/vpn-keys/create/route.ts', routeStr);
console.log('Fixed Activity log parameter!');
