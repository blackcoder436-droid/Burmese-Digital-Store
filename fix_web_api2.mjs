import fs from 'fs';
let c = fs.readFileSync('src/app/api/admin/vpn-keys/create/route.ts', 'utf8');

// 1. Target Servers
c = c.replace(/let targetServers = \[\];/g, "let targetServers: any[] = [];");

// 2. Client / db
c = c.replace(/const client = await clientPromise;\s*const db = client\.db\(\);/g, "const mongoose = await import('mongoose');\n    const db = mongoose.connection.getClient().db();");

// 3. User Id handling
c = c.replace(/user\.id/g, "(user as any).id");

// 4. provisionVpnKey params Expected 1 arguments, but got 7
c = c.replace(/provisionVpnKey\(\s*server\.id,\s*\(user as any\)\.id \|\| 'admin_web',\s*deviceLimit,\s*days,\s*limitGB,\s*protocol,\s*finalUsername\s*\)/g, "provisionVpnKey({ serverId: server.id, userId: (user as any).id || 'admin_web', devices: deviceLimit, expiryDays: days, dataLimitGB: limitGB, protocol, username: finalUsername })");
// Actually I need to match the previous payload
c = c.replace(/await provisionVpnKey\([\s\S]*?finalUsername\n\s*\);/m, "await provisionVpnKey({ serverId: server.id, userId: (user as any).id?.toString() || 'admin_web', devices: deviceLimit, expiryDays: days, dataLimitGB: limitGB, protocol, username: finalUsername });");

// 5. ActivityAction
c = c.replace(/action: 'vpn_key_generated' as any/g, "action: 'vpn_key_generated' as any, target: 'system'");

fs.writeFileSync('src/app/api/admin/vpn-keys/create/route.ts', c);
console.log('Fixed Web Admin Create Key API 2');
