import fs from 'fs';

let adminFile = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

adminFile = adminFile.replace(
`      await db.collection('vpn_keys').insertOne({
          userId: 'admin_bot_' + chatId,
          token: token,
          username,
          keyType,
          protocol,
          devices,
          expiryDays,
          dataLimitGB,
          createdAt: new Date(),
          status: 'active'
      });`,
`      await db.collection('vpn_keys').insertOne({
          userId: 'admin_bot_' + chatId,
          token: token,
          username,
          keyType,
          protocol,
          devices,
          expiryDays,
          expiryTime: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
          dataLimitGB,
          createdAt: new Date(),
          status: 'active',
          serverSubLinks
      });`
);

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', adminFile);

let subRoute = fs.readFileSync('src/app/api/vpn/sub/[token]/route.ts', 'utf8');
subRoute = subRoute.replace(
`    const client = await clientPromise;
    const adminKey = await client.db().collection('vpn_keys').findOne({ token });`,
`    const _mongoose = await connectDB();
    const db = _mongoose.connection.getClient().db();
    const adminKey = await db.collection('vpn_keys').findOne({ token });`
);

fs.writeFileSync('src/app/api/vpn/sub/[token]/route.ts', subRoute);

console.log('Fixed Bot Key Creation and Sub Route!');
