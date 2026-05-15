import fs from 'fs';

// 1. Fix Mongoose ActivityLog validation error
let logModel = fs.readFileSync('src/models/ActivityLog.ts', 'utf8');
logModel = logModel.replace(/enum: \[\s+'order_approved',/, `enum: [
        'vpn_key_generated',
        'order_approved',`);
fs.writeFileSync('src/models/ActivityLog.ts', logModel);

// 2. Fix api/vpn/sub/[token]/route.ts to look for both vpn_keys and Order
let subRoute = fs.readFileSync('src/app/api/vpn/sub/[token]/route.ts', 'utf8');
subRoute = subRoute.replace("import Order from '@/models/Order';", "import Order from '@/models/Order';\nimport { default as clientPromise } from '@/lib/mongodb';");
subRoute = subRoute.replace(
  "const order = await Order.findOne({ multiSubToken: token }).lean();",
  `const client = await clientPromise;
    const vpnKey = await client.db().collection('vpn_keys').findOne({ token });
    if (vpnKey) {
      if (vpnKey.expiryTime && Date.now() > vpnKey.expiryTime) {
        return new NextResponse('Subscription expired', { status: 403 });
      }
      
      const configs = [];
      // We stored multiServerLinks as names, but we might not have the direct sublinks of each server in vpnKey.
      // Wait, we need the direct sublinks! 
      // Let's check how the vpn_keys document is structured.
    }
    const order = await Order.findOne({ multiSubToken: token }).lean();`
);
// Actually, let's just write the whole sub route file over again to be clean.
