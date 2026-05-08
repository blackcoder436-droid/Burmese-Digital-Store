const fs = require('fs');

const files = [
    'src/lib/telegram-bot/handlers/keys.ts',
    'src/lib/telegram-bot/handlers/referral.ts',
    'src/lib/telegram-bot/handlers/free-test.ts'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Revert the bad change (remove \) and fix
    content = content.replace(/\\\n,\n  messageId\?: number\n/g, 'username?: string,\n  messageId?: number\n');
    
    // Actually wait, let's just do a git checkout to restore them to clean state and then apply the proper regex
    // But since git status showed them already modified, git checkout would reset previous good modifications!
    // So let's fix manually or parse carefully.
}
