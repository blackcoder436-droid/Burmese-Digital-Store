const fs = require('fs');
let code = fs.readFileSync('src/app/admin/rotate/page.tsx', 'utf-8');
if (!code.includes('ShieldCheck')) {
  code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, (m, p1) => {
    return 'import {' + p1 + ', ShieldCheck, Sparkles, CheckCircle2, ListRestart } from "lucide-react";';
  });
  fs.writeFileSync('src/app/admin/rotate/page.tsx', code);
  console.log('Imports added!');
} else {
  console.log('Already has ShieldCheck');
}
