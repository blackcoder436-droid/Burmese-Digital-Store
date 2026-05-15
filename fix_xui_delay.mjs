import fs from 'fs';
let xuiConfig = fs.readFileSync('src/lib/xui.ts', 'utf8');

xuiConfig = xuiConfig.replace('const SUB_FETCH_RETRIES = 3;', 'const SUB_FETCH_RETRIES = 1;');
xuiConfig = xuiConfig.replace('const SUB_FETCH_DELAY_MS = 2000;', 'const SUB_FETCH_DELAY_MS = 500;');

fs.writeFileSync('src/lib/xui.ts', xuiConfig);
console.log('Fixed XUI wait delay!');
