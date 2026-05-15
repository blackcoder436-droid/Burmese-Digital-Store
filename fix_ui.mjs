import fs from 'fs';
let c = fs.readFileSync('src/app/admin/vpn-keys/page.tsx', 'utf8');

c = c.replace(
  /setAvailableServers\(data\.data\.servers\);/g,
  "const augmentedServers = [{ id: 'all', name: '🌐 All Servers (Multi-server)', flag: '🌐', isOnline: true, enabledProtocols: ['vless', 'vmess', 'trojan'] }, ...data.data.servers];\n          setAvailableServers(augmentedServers as any);"
);

c = c.replace(
  /data\.data\.servers\.length > 0 && !createServerId/g,
  "augmentedServers.length > 0 && !createServerId"
);

c = c.replace(
  /setCreateServerId\(data\.data\.servers\[0\]\.id\);/g,
  "setCreateServerId(augmentedServers[0].id);"
);

c = c.replace(
  /setCreateProtocol\(data\.data\.servers\[0\]\.enabledProtocols\[0\] \|\| 'trojan'\);/g,
  "setCreateProtocol(augmentedServers[0].enabledProtocols[0] || 'trojan');"
);

fs.writeFileSync('src/app/admin/vpn-keys/page.tsx', c);
console.log('Fixed Frontend UI Selection');
