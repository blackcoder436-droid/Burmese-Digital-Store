import { execSync } from 'child_process';
import fs from 'fs';

// Get the original admin.ts
const originCode = execSync('git show f247b6f:src/lib/telegram-bot/handlers/admin.ts', {encoding: 'utf8'});

// The missing functions start with "export function isAdmin" and end right before "export async function handleAdminCreateKey"
const startStr = "export function isAdmin(";
const endStr = "export async function handleAdminCreateKey";

const startIndex = originCode.indexOf(startStr);
const endIndex = originCode.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const missingCode = "\n" + originCode.substring(startIndex, endIndex);
    
    // Now append missingCode to our current admin.ts
    // Wait, let's just insert it after the imports and existing variables, say before createAdminKey
    let currentCode = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');
    
    // find a place to put it
    const insertIdx = currentCode.indexOf("export async function handleAdminCommand(");
    if(insertIdx !== -1) {
        currentCode = currentCode.substring(0, insertIdx) + missingCode + currentCode.substring(insertIdx);
        fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', currentCode);
        console.log("RESTORED!");
    } else {
        console.log("Could not find insert spot");
    }
}
