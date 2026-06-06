import { Client } from 'ssh2';
import * as fs from 'fs';
import { execSync } from 'child_process';

console.log('Creating tar archive of local public/uploads...');
try {
  execSync('tar -czf uploads_archive.tar.gz -C public uploads');
  console.log('Archive created successfully.');
} catch (e) {
  console.error('Failed to create archive:', e.message);
  process.exit(1);
}

const conn = new Client();
console.log('Connecting to VPS...');

conn.on('ready', () => {
  console.log('SSH connection established. Uploading archive...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut('uploads_archive.tar.gz', '/var/www/burmese-digital-store/uploads_archive.tar.gz', (err) => {
      if (err) throw err;
      console.log('Upload complete. Extracting on server...');
      conn.exec('cd /var/www/burmese-digital-store && tar -xzf uploads_archive.tar.gz -C public/ && rm uploads_archive.tar.gz', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log(`Extraction complete. Server exited with code: ${code}`);
          conn.end();
          fs.unlinkSync('uploads_archive.tar.gz'); // Clean up locally
          console.log('Images are now successfully deployed!');
        }).on('data', (data) => {
          console.log('OUTPUT: ' + data);
        }).stderr.on('data', (data) => {
          console.error('ERROR: ' + data);
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err.message);
}).connect({
  host: '139.59.247.115',
  port: 22,
  username: 'root',
  password: 'Mka@2016Omk' 
});