import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';

const conn = new Client();
const localUploadsDir = path.join(process.cwd(), 'public', 'uploads');
const remoteUploadsDir = '/var/www/burmese-digital-store/public/uploads';

console.log('Connecting to VPS to upload images...');

conn.on('ready', () => {
  console.log('SSH connection established. Uploading files...');
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    // Read local files
    fs.readdir(localUploadsDir, (err, files) => {
      if (err) {
        console.error('Error reading local uploads directory:', err);
        conn.end();
        return;
      }
      
      const fileList = files.filter(f => f !== '.gitkeep' && fs.statSync(path.join(localUploadsDir, f)).isFile());
      let uploadedCount = 0;
      
      if (fileList.length === 0) {
        console.log('No files to upload.');
        conn.end();
        return;
      }

      console.log(`Found ${fileList.length} files to upload.`);

      fileList.forEach(file => {
        const localPath = path.join(localUploadsDir, file);
        const remotePath = `${remoteUploadsDir}/${file}`;
        
        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) {
            console.error(`Failed to upload ${file}:`, err);
          } else {
            console.log(`Successfully uploaded: ${file}`);
          }
          
          uploadedCount++;
          if (uploadedCount === fileList.length) {
            console.log('\nAll images uploaded successfully!');
            conn.end();
          }
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
