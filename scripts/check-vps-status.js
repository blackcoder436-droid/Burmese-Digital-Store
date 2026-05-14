const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const servers = [
    { name: 'jan', ip: '134.209.98.219', pass: 'Mka@2016Omk' },
    { name: 'sg1', ip: '139.59.97.203', pass: 'Mka@2016Omk' },
    { name: 'sg2', ip: '165.245.177.156', pass: 'Mka@2016Omk' },
    { name: 'sg3', ip: '68.183.191.103', pass: 'Mka@2016Omk' },
    { name: 'sg4', ip: '157.245.50.118', pass: 'Mka@2016Omk' },
    { name: 'us', ip: '147.182.209.170', pass: 'Mka@2016Omk' }
];

async function checkServers() {
    console.log("Starting VPS and 3xui status check...\n");
    for (const server of servers) {
        console.log(`Checking ${server.name} (${server.ip})...`);
        try {
            // Using sshpass to pass password in script, requiring sshpass installed.
            const cmd = `sshpass -p '${server.pass}' ssh -o StrictHostKeyChecking=no root@${server.ip} 'systemctl is-active x-ui'`;
            const { stdout, stderr } = await execPromise(cmd, { timeout: 10000 });
            
            if (stdout.trim() === 'active') {
                console.log(`✅ ${server.name} [${server.ip}]: x-ui is active and running.`);
            } else {
                console.log(`❌ ${server.name} [${server.ip}]: x-ui is ${stdout.trim()}`);
            }
        } catch (error) {
            console.log(`❌ ${server.name} [${server.ip}]: Connection failed or x-ui is not running. (${error.message.split('\\n')[0]})`);
        }
    }
    console.log("\nCheck completed!");
}

checkServers();
