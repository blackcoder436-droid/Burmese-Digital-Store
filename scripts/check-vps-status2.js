const { Client } = require('ssh2');

const servers = [
    { name: 'jan', ip: '134.209.98.219', pass: 'Mka@2016Omk' },
    { name: 'sg1', ip: '139.59.97.203', pass: 'Mka@2016Omk' },
    { name: 'sg2', ip: '165.245.177.156', pass: 'Mka@2016Omk' },
    { name: 'sg3', ip: '68.183.191.103', pass: 'Mka@2016Omk' },
    { name: 'sg4', ip: '157.245.50.118', pass: 'Mka@2016Omk' },
    { name: 'us', ip: '147.182.209.170', pass: 'Mka@2016Omk' }
];

async function checkServer(server) {
    return new Promise((resolve) => {
        const conn = new Client();
        conn.on('ready', () => {
            conn.exec('systemctl is-active x-ui', (err, stream) => {
                if (err) {
                    resolve(`❌ ${server.name} [${server.ip}]: Error executing command`);
                    return conn.end();
                }
                let output = '';
                stream.on('data', (data) => { output += data.toString(); })
                      .on('close', () => {
                          const status = output.trim();
                          if (status === 'active') {
                              resolve(`✅ ${server.name} [${server.ip}]: x-ui is active and running.`);
                          } else {
                              resolve(`❌ ${server.name} [${server.ip}]: x-ui is ${status}`);
                          }
                          conn.end();
                      });
            });
        }).on('error', (err) => {
            resolve(`❌ ${server.name} [${server.ip}]: Connection failed (${err.message})`);
        }).connect({
            host: server.ip,
            port: 22,
            username: 'root',
            password: server.pass,
            readyTimeout: 10000
        });
    });
}

async function checkAll() {
    console.log("Starting VPS and 3xui status check...\n");
    for (const server of servers) {
        process.stdout.write(`Checking ${server.name} (${server.ip})... `);
        const result = await checkServer(server);
        console.log(`\n${result}`);
    }
    console.log("\nCheck completed!");
}

checkAll();