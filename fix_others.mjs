import fs from 'fs';

// Fix TS errors in admin.ts
let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

// replace dynamic mongoClient connection
// "const mongoClient = (await import('@/lib/mongodb')).default;\n  const db = (await mongoClient).connection?.db || (await mongoClient).db();"
code = code.replace(/const mongoClient = \(await import\('@\/lib\/mongodb'\)\)\.default;/g, "const { default: clientPromise } = await import('@/lib/mongodb');");
code = code.replace(/const db = \(await mongoClient\)\.connection\?\.db \|\| \(await mongoClient\)\.db\(\);/g, "const client = await clientPromise;\n  const db = client.db();");

// Fix randomBytes and uuid errors in admin.ts
code = code.replace(/const \{ randomBytes \} = await import\('crypto'\);/g, ""); // remove existing
code = code.replace(/const token = randomBytes\(16\)\.toString\('hex'\);/g, "const { randomBytes } = await import('crypto');\n      const token = randomBytes(16).toString('hex');");

code = code.replace(/import \{ v4 as uuidv4 \} from 'uuid';/g, ""); // remove uuidv4 import

// replace generateVpnUrl -> generateSubscriptionUrl with hardcoded url or remove it
code = code.replace(/const url = generateVpnUrl\([^)]+\);/g, "const url = `https://burmesedigital.store/api/vpn/sub/${token}`;");
code = code.replace(/generateVpnUrl\([^)]+\)/g, "`https://burmesedigital.store/api/vpn/sub/${token}`");

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);

// Fix free-test.ts messageId
let ft = fs.readFileSync('src/lib/telegram-bot/handlers/free-test.ts', 'utf8');
ft = ft.replace(/messageId,/g, "ctx.message?.message_id,"); // Replace isolated messageId with ctx.message?.message_id
fs.writeFileSync('src/lib/telegram-bot/handlers/free-test.ts', ft);

// Fix TS in vps.ts
let vps = fs.readFileSync('src/lib/telegram-bot/handlers/vps.ts', 'utf8');
vps = vps.replace(/import \{ connectDB \} from '@\/lib\/mongodb'/g, "import { default as clientPromise } from '@/lib/mongodb'");
vps = vps.replace(/await connectDB\(\)/g, "const client = await clientPromise;\n  const mongoose = await import('mongoose');\n  if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGODB_URI as string);");

// bot session error
vps = vps.replace(/ctx\.session/g, "(ctx as any).session");
vps = vps.replace(/ctx\.answerCbQuery\(\)/g, "ctx.answerCallbackQuery && await ctx.answerCallbackQuery()");
vps = vps.replace(/ctx\.fromUser/g, "(ctx.from)");
fs.writeFileSync('src/lib/telegram-bot/handlers/vps.ts', vps);

console.log('Fixed additional admin, free-test, vps errors');
