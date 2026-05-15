import { Client } from 'ssh2';
import fs from 'fs';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const routeCode = fs.readFileSync('src/app/api/admin/vpn-keys/create/route.ts');
    sftp.writeFile('/var/www/burmese-digital-store/src/app/api/admin/vpn-keys/create/route.ts', routeCode, (err) => {
      console.log('Uploaded route.ts');
      
      const adminCode = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts');
      sftp.writeFile('/var/www/burmese-digital-store/src/lib/telegram-bot/handlers/admin.ts', adminCode, (err) => {
        console.log('Uploaded admin.ts');
        
        console.log('Executing build...');
        conn.exec('cd /var/www/burmese-digital-store && NODE_OPTIONS=--max-old-space-size=1024 npm run build && pm2 restart burmese-digital-store', (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code);
            conn.end();
          }).on('data', (data) => {
            process.stdout.write(data);
          }).stderr.on('data', (data) => {
            process.stderr.write(data);
          });
        });
      });
    });
  });
}).connect({
  host: '139.59.247.115',
  port: 22,
  username: 'root',
  password: 'Mka@2016Omk' 
});
