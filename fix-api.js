const fs = require('fs');
let file = fs.readFileSync('src/app/api/admin/vpn-keys/create/route.ts', 'utf8');
file = file.replace('requireAdmin(req)', 'requireAdmin()');
file = file.replace("adminId: user._id?.toString() || 'unknown',", "admin: user.id || 'unknown',");
fs.writeFileSync('src/app/api/admin/vpn-keys/create/route.ts', file);
