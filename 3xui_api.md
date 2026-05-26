API Documentation
The 3x-ui panel exposes a REST API under /panel/api/. Authenticate with the panel session cookie, or with the Authorization: Bearer <token> header below. Every endpoint returns a uniform { success, msg, obj } envelope unless otherwise noted.

API Tokens
Create, enable, or revoke named Bearer tokens in Settings → Security. Send each request as Authorization: Bearer <token>. Token-authenticated callers skip CSRF and don't need a session cookie. Deleting a token revokes it immediately — running bots will need a new one.

Quick example
TEXT

curl -X GET \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Accept: application/json" \
  https://your-panel.example.com/panel/api/inbounds/list
On this page:
Authentication
4
Inbounds
26
Server
26
Nodes
9
Custom Geo
7
Backup
1
Settings
6
API Tokens
4
Xray Settings
9
Subscription Server
3
WebSocket
5
Two authentication modes are supported. UI sessions use a cookie set by the login endpoint. Programmatic clients (bots, scripts, remote panels) authenticate with a Bearer token taken from Settings → Security → API Token. Both work for every endpoint under /panel/api/*.

POST
/login
Authenticate with username + password and receive a session cookie. Required before any cookie-based API call.

Parameters
Name	In	Type	Description
username	body	string	Panel admin username.
password	body	string	Panel admin password.
twoFactorCode	body	string	OTP code when 2FA is enabled. Omit otherwise.
Request body
JSON

{
  "username": "admin",
  "password": "admin",
  "twoFactorCode": "123456"
}
Response
JSON

{
  "success": true,
  "msg": "Logged in successfully"
}
Error response
JSON

{
  "success": false,
  "msg": "Wrong username or password"
}
POST
/logout
Clear the session cookie. Requires the CSRF header for browser sessions.

Response
JSON

{
  "success": true
}
GET
/csrf-token
Mint a CSRF token for the current session. The SPA replays it in the X-CSRF-Token header on unsafe requests. Bearer-token callers can skip this — the middleware short-circuits CSRF for authenticated API requests.

Response
JSON

{
  "success": true,
  "obj": "csrf-token-string"
}
POST
/getTwoFactorEnable
Returns whether 2FA is enabled on the panel — used by the login page to decide whether to show the OTP field.

Response
JSON

{
  "success": true,
  "obj": false
}
Manage inbound configurations and their clients. All endpoints live under /panel/api/inbounds and require a logged-in session or Bearer token. Link-generating endpoints honour forwarded headers only when the request comes from a configured trusted proxy.

GET
/panel/api/inbounds/list
List every inbound owned by the authenticated user, including each inbound’s clientStats traffic counters.

Response
JSON

{
  "success": true,
  "obj": [
    {
      "id": 1,
      "userId": 1,
      "up": 0,
      "down": 0,
      "total": 0,
      "remark": "VLESS-443",
      "enable": true,
      "expiryTime": 0,
      "listen": "",
      "port": 443,
      "protocol": "vless",
      "settings": "{\"clients\":[...]}",
      "streamSettings": "{...}",
      "tag": "inbound-443",
      "sniffing": "{...}",
      "clientStats": [...]
    }
  ]
}
GET
/panel/api/inbounds/get/:id
Fetch a single inbound by numeric ID.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
GET
/panel/api/inbounds/getClientTraffics/:email
Traffic counters for a client identified by email.

Parameters
Name	In	Type	Description
email	path	string	Client email (unique across the panel).
Response
JSON

{
  "success": true,
  "obj": {
    "email": "user1",
    "up": 1048576,
    "down": 2097152,
    "total": 10737418240,
    "expiryTime": 1735689600000
  }
}
GET
/panel/api/inbounds/getClientTrafficsById/:id
Traffic counters for a client identified by its UUID/password.

Parameters
Name	In	Type	Description
id	path	string	Client subId / UUID.
Response
JSON

{
  "success": true,
  "obj": {
    "email": "user1",
    "up": 1048576,
    "down": 2097152,
    "total": 10737418240,
    "expiryTime": 1735689600000
  }
}
POST
/panel/api/inbounds/add
Create a new inbound. Send the full inbound payload (protocol, port, settings JSON, streamSettings JSON, sniffing JSON, remark, expiryTime, total, enable).

Request body
JSON

{
  "enable": true,
  "remark": "VLESS-443",
  "listen": "",
  "port": 443,
  "protocol": "vless",
  "expiryTime": 0,
  "total": 0,
  "settings": "{\"clients\":[{\"id\":\"...\",\"email\":\"user1\"}],\"decryption\":\"none\",\"fallbacks\":[]}",
  "streamSettings": "{\"network\":\"tcp\",\"security\":\"reality\",\"realitySettings\":{...}}",
  "sniffing": "{\"enabled\":true,\"destOverride\":[\"http\",\"tls\"]}"
}
Error response
JSON

{
  "success": false,
  "msg": "Port 443 is already in use"
}
POST
/panel/api/inbounds/del/:id
Delete an inbound by ID. Also removes its associated client stats rows.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
POST
/panel/api/inbounds/update/:id
Replace an inbound’s configuration. Body shape mirrors /add. Heavy on inbounds with thousands of clients — prefer /setEnable for enable-only flips.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
POST
/panel/api/inbounds/setEnable/:id
Toggle only the enable flag without serialising the whole settings JSON. Recommended for UI switches on large inbounds.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
Request body
JSON

{
  "enable": false
}
POST
/panel/api/inbounds/clientIps/:email
List source IPs that have connected with the given client’s credentials. Returns an array of "ip (timestamp)" strings.

Parameters
Name	In	Type	Description
email	path	string	Client email.
POST
/panel/api/inbounds/clearClientIps/:email
Reset the recorded IP list for a client.

Parameters
Name	In	Type	Description
email	path	string	Client email.
POST
/panel/api/inbounds/addClient
Add one or more clients to an existing inbound. The settings field is the JSON-encoded settings.clients array of the target inbound.

Request body
JSON

{
  "id": 1,
  "settings": "{\"clients\":[{\"id\":\"uuid-here\",\"email\":\"newuser\",\"limitIp\":0,\"totalGB\":0,\"expiryTime\":0,\"enable\":true,\"flow\":\"\"}]}"
}
POST
/panel/api/inbounds/:id/copyClients
Copy selected clients from one inbound into another. Useful for duplicating user lists across protocols.

Parameters
Name	In	Type	Description
id	path	number	Target inbound ID.
sourceInboundId	body	number	Inbound ID to read clients from.
clientEmails	body	string[]	Emails of clients to copy. Empty means all clients.
flow	body	string	Override the flow field on copied clients (e.g. "xtls-rprx-vision"). Empty to keep source flow.
POST
/panel/api/inbounds/:id/delClient/:clientId
Delete a client by its UUID/password from a specific inbound.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
clientId	path	string	Client UUID / password.
POST
/panel/api/inbounds/updateClient/:clientId
Update a single client without rewriting the whole settings JSON. Send the target inbound payload with the new client values.

Parameters
Name	In	Type	Description
clientId	path	string	Client UUID / password.
Request body
JSON

{
  "id": 1,
  "settings": "{\"clients\":[{\"id\":\"uuid-here\",\"email\":\"user1\",\"limitIp\":2,\"totalGB\":10737418240,\"expiryTime\":1735689600000,\"enable\":true}]}"
}
POST
/panel/api/inbounds/:id/resetTraffic
Zero out upload + download counters for a single inbound. Does not touch per-client counters.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
POST
/panel/api/inbounds/:id/resetClientTraffic/:email
Zero out upload + download counters for one client.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
email	path	string	Client email.
POST
/panel/api/inbounds/resetAllTraffics
Reset upload + download counters on every inbound. Destructive — accounting history is lost.

POST
/panel/api/inbounds/resetAllClientTraffics/:id
Reset traffic for every client in one inbound.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
POST
/panel/api/inbounds/delDepletedClients/:id
Delete clients in this inbound whose traffic cap or expiry has elapsed. Pass id=-1 to sweep every inbound.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID, or -1 for all inbounds.
POST
/panel/api/inbounds/import
Bulk-import an inbound from a JSON blob (e.g. one exported via the UI). The body uses form encoding with a single "data" field.

Parameters
Name	In	Type	Description
data	body (form)	string	JSON-encoded inbound payload.
POST
/panel/api/inbounds/onlines
List the emails of currently connected clients (last seen within the heartbeat window).

Response
JSON

{
  "success": true,
  "obj": ["user1", "user2"]
}
POST
/panel/api/inbounds/lastOnline
Map of client email → last-seen unix timestamp.

Response
JSON

{
  "success": true,
  "obj": [
    { "email": "user1", "lastOnline": 1700000000 },
    { "email": "user2", "lastOnline": 1699999000 }
  ]
}
GET
/panel/api/inbounds/getSubLinks/:subId
Return every protocol URL (vless://, vmess://, trojan://, ss://, hysteria://, hy2://) for clients matching the subscription ID. Same result set as /sub/<subId>, but as a JSON array — no base64. When an inbound has streamSettings.externalProxy set, one URL is emitted per external proxy. Empty array when the subId has no enabled clients.

Parameters
Name	In	Type	Description
subId	path	string	Subscription ID, taken from the client's subId field.
Response
JSON

{
  "success": true,
  "obj": [
    "vless://uuid@host:443?security=reality&...#user1",
    "vmess://eyJ2IjoyLC..."
  ]
}
GET
/panel/api/inbounds/getClientLinks/:id/:email
Return the URL(s) for one client on one inbound — the same string the Copy URL button copies in the panel UI. Supported protocols: vmess, vless, trojan, shadowsocks, hysteria, hysteria2. If streamSettings.externalProxy is set, returns one URL per external proxy. Protocols without a URL form (socks, http, mixed, wireguard, dokodemo, tunnel) return an empty array.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
email	path	string	Client email.
Response
JSON

{
  "success": true,
  "obj": [
    "vless://uuid@host:443?...#user1"
  ]
}
POST
/panel/api/inbounds/updateClientTraffic/:email
Manually adjust a client’s upload + download counters. Useful for migrations from external accounting systems.

Parameters
Name	In	Type	Description
email	path	string	Client email.
Request body
JSON

{
  "upload": 1073741824,
  "download": 5368709120
}
POST
/panel/api/inbounds/:id/delClientByEmail/:email
Delete a client identified by email rather than UUID.

Parameters
Name	In	Type	Description
id	path	number	Inbound ID.
email	path	string	Client email.
System status, log retrieval, certificate generators, Xray binary management, and backup/restore. All under /panel/api/server.

GET
/panel/api/server/status
Real-time machine snapshot: CPU, memory, swap, disk, network IO, load averages, open connections, Xray state. Cached and refreshed every 2 seconds in the background.

Response
JSON

{
  "success": true,
  "obj": {
    "cpu": 12.5,
    "mem": { "current": 2147483648, "total": 8589934592 },
    "swap": { "current": 0, "total": 4294967296 },
    "disk": { "current": 53687091200, "total": 268435456000 },
    "netIO": { "up": 1073741824, "down": 2147483648 },
    "xray": { "state": "running", "version": "v25.10.31" },
    "tcpCount": 42,
    "load": { "load1": 0.5, "load5": 0.3, "load15": 0.2 }
  }
}
GET
/panel/api/server/cpuHistory/:bucket
Legacy: aggregated CPU history. Use /history/cpu/:bucket instead — same data with a uniform {t, v} shape.

Parameters
Name	In	Type	Description
bucket	path	number	Bucket size in seconds. Allowed: 2, 30, 60, 120, 180, 300.
GET
/panel/api/server/history/:metric/:bucket
Aggregated time-series for one metric. Returns an array of {t, v} samples covering the last ~6 hours.

Parameters
Name	In	Type	Description
metric	path	string	cpu | mem | netUp | netDown | online | load1 | load5 | load15.
bucket	path	number	Bucket size in seconds. Allowed: 2, 30, 60, 120, 180, 300.
Response
JSON

{
  "success": true,
  "obj": [
    { "t": 1700000000, "v": 12.5 },
    { "t": 1700000002, "v": 13.1 }
  ]
}
GET
/panel/api/server/xrayMetricsState
Xray runtime metrics state — whether the xray config has a `metrics` block, which expvar keys are flowing, and the current snapshot values for each. Returns an empty state when metrics are not configured.

GET
/panel/api/server/xrayMetricsHistory/:metric/:bucket
Time-series history for one Xray runtime metric over the last ~6 hours. Same {t, v} shape as /history/:metric/:bucket.

Parameters
Name	In	Type	Description
metric	path	string	xrAlloc | xrSys | xrHeapObjects | xrNumGC | xrPauseNs.
bucket	path	number	Bucket size in seconds. Allowed: 2, 30, 60, 120, 180, 300.
GET
/panel/api/server/xrayObservatory
Latest snapshot from the Xray observatory — per-outbound latency, health status, and last-probe time. Only populated when the Xray config has an observatory configured.

GET
/panel/api/server/xrayObservatoryHistory/:tag/:bucket
Time-series of observatory probe results for one outbound tag. Same {t, v} shape as the other history endpoints.

Parameters
Name	In	Type	Description
tag	path	string	Outbound tag from the observatory config.
bucket	path	number	Bucket size in seconds. Allowed: 2, 30, 60, 120, 180, 300.
GET
/panel/api/server/getXrayVersion
List Xray binary versions available for install on this host.

Response
JSON

{
  "success": true,
  "obj": ["v25.10.31", "v25.9.15", "v25.8.1"]
}
GET
/panel/api/server/getPanelUpdateInfo
Check whether a newer 3x-ui release is available on GitHub.

GET
/panel/api/server/getConfigJson
Return the assembled Xray config that’s currently running on this host.

Response
JSON

{
  "success": true,
  "obj": {
    "log": { "loglevel": "warning" },
    "inbounds": [...],
    "outbounds": [...],
    "routing": { "rules": [...] }
  }
}
GET
/panel/api/server/getDb
Stream the SQLite database file as an attachment. Use as a manual backup.

GET
/panel/api/server/getNewUUID
Generate a fresh UUID v4. Convenience helper for client IDs.

Response
JSON

{
  "success": true,
  "obj": "550e8400-e29b-41d4-a716-446655440000"
}
GET
/panel/api/server/getNewX25519Cert
Generate a new X25519 keypair for Reality.

Response
JSON

{
  "success": true,
  "obj": {
    "privateKey": "uN9qLfV3zH8w...",
    "publicKey": "5v8xPqR2sM7k..."
  }
}
GET
/panel/api/server/getNewmldsa65
Generate a new ML-DSA-65 keypair (post-quantum signature). Returns {privateKey, publicKey, seed}.

Response
JSON

{
  "success": true,
  "obj": {
    "privateKey": "mdsa65priv...",
    "publicKey": "mdsa65pub...",
    "seed": "random-seed..."
  }
}
GET
/panel/api/server/getNewmlkem768
Generate a new ML-KEM-768 keypair (post-quantum KEM). Returns {clientKey, serverKey}.

Response
JSON

{
  "success": true,
  "obj": {
    "clientKey": "mlkem768-client...",
    "serverKey": "mlkem768-server..."
  }
}
GET
/panel/api/server/getNewVlessEnc
Generate VLESS encryption auth options. Returns an auths array each with id, label, encryption, and decryption fields.

Response
JSON

{
  "success": true,
  "obj": {
    "auths": [
      { "id": 0, "label": "Auth #0", "encryption": "aes-256-gcm", "decryption": "" }
    ]
  }
}
POST
/panel/api/server/stopXrayService
Stop the Xray binary. All proxies go offline immediately.

Error response
JSON

{
  "success": false,
  "msg": "Xray is not running"
}
POST
/panel/api/server/restartXrayService
Reload Xray with the current config. Typically required after structural inbound or routing changes.

Error response
JSON

{
  "success": false,
  "msg": "Xray config is invalid: ..."
}
POST
/panel/api/server/installXray/:version
Download and install the specified Xray version. Pass "latest" for the newest release.

Parameters
Name	In	Type	Description
version	path	string	Xray tag (e.g. v25.10.31) or "latest".
POST
/panel/api/server/updatePanel
Self-update the panel to the latest version. The server restarts on success.

POST
/panel/api/server/updateGeofile
Refresh the default GeoIP / GeoSite data files. Body can include a fileName, or use the /:fileName variant.

Parameters
Name	In	Type	Description
fileName	body (form)	string	Filename to update (e.g. geoip.dat, geosite.dat). Omit to update all defaults.
Request body
JSON

fileName=geoip.dat
POST
/panel/api/server/updateGeofile/:fileName
Refresh a single Geo file by filename (e.g. geoip.dat, geosite.dat).

Parameters
Name	In	Type	Description
fileName	path	string	Filename of the data file to refresh.
POST
/panel/api/server/logs/:count
Return the last N lines of the panel’s own log.

Parameters
Name	In	Type	Description
count	path	number	Number of trailing log lines.
Request body
JSON

{
  "level": "info",
  "syslog": false
}
Response
JSON

{
  "success": true,
  "obj": "2025/01/01 12:00:00 [INFO] Server started\n2025/01/01 12:00:01 [INFO] Xray is running"
}
POST
/panel/api/server/xraylogs/:count
Return the last N lines of the Xray process log.

Parameters
Name	In	Type	Description
count	path	number	Number of trailing log lines.
filter	body (form)	string	Keyword filter — only lines containing this string.
showDirect	body (form)	string	"true" to include direct (freedom) traffic lines.
showBlocked	body (form)	string	"true" to include blocked (blackhole) traffic lines.
showProxy	body (form)	string	"true" to include proxy traffic lines.
Request body
JSON

filter=error&showDirect=false&showBlocked=true&showProxy=true
Response
JSON

{
  "success": true,
  "obj": "2025/01/01 12:00:00 rejected  vless  proxy  example.com  reason: no valid user\n2025/01/01 12:00:01 direct  freedom  ok"
}
POST
/panel/api/server/importDB
Restore the panel DB from an uploaded SQLite file (multipart form, field name "db"). The panel restarts after restore. Destructive.

Parameters
Name	In	Type	Description
db	body (multipart)	file	SQLite database file to upload.
POST
/panel/api/server/getNewEchCert
Generate a new ECH (Encrypted Client Hello) keypair and config list for the given SNI.

Parameters
Name	In	Type	Description
sni	body (form)	string	Server Name Indication to generate the ECH config for.
Request body
JSON

sni=example.com
Response
JSON

{
  "success": true,
  "obj": {
    "echKeySet": "...",
    "echServerKeys": [...],
    "echConfigList": "..."
  }
}
Manage remote 3x-ui panels acting as nodes for a central panel. All endpoints under /panel/api/nodes.

GET
/panel/api/nodes/list
List every configured node with its connection details, health, and last heartbeat patch.

Response
JSON

{
  "success": true,
  "obj": [
    {
      "id": 1,
      "name": "de-fra-1",
      "scheme": "https",
      "host": "node1.example.com",
      "port": 2053,
      "status": "online",
      "cpu": 23.5,
      "mem": 45.1
    }
  ]
}
GET
/panel/api/nodes/get/:id
Fetch a single node by ID.

Parameters
Name	In	Type	Description
id	path	number	Node ID.
POST
/panel/api/nodes/add
Register a new remote node. Provide its URL, apiToken, and optional label/notes.

Request body
JSON

{
  "name": "de-fra-1",
  "scheme": "https",
  "host": "node1.example.com",
  "port": 2053,
  "basePath": "/",
  "apiToken": "abcdef..."
}
POST
/panel/api/nodes/update/:id
Replace a node’s connection details. Same body shape as /add.

Parameters
Name	In	Type	Description
id	path	number	Node ID.
Request body
JSON

{
  "name": "de-fra-1",
  "scheme": "https",
  "host": "node1.example.com",
  "port": 2053,
  "basePath": "/",
  "apiToken": "abcdef..."
}
POST
/panel/api/nodes/del/:id
Delete a node. Inbounds bound to it are not auto-migrated.

Parameters
Name	In	Type	Description
id	path	number	Node ID.
POST
/panel/api/nodes/setEnable/:id
Pause or resume traffic sync with this node.

Parameters
Name	In	Type	Description
id	path	number	Node ID.
Request body
JSON

{
  "enable": true
}
POST
/panel/api/nodes/test
Probe a node without saving it. Uses the body as connection details and returns whether the handshake succeeds.

Request body
JSON

{
  "scheme": "https",
  "host": "node1.example.com",
  "port": 2053,
  "basePath": "/",
  "apiToken": "abcdef..."
}
Response
JSON

{
  "success": true,
  "obj": {
    "status": "online",
    "cpu": 12.5,
    "mem": 45.2
  }
}
POST
/panel/api/nodes/probe/:id
Probe an existing node, updating its cached health state.

Parameters
Name	In	Type	Description
id	path	number	Node ID.
GET
/panel/api/nodes/history/:id/:metric/:bucket
Aggregated metric history for a node — same shape as /server/history, scoped to one node.

Parameters
Name	In	Type	Description
id	path	number	Node ID.
metric	path	string	cpu | mem.
bucket	path	number	Bucket size in seconds. Allowed: 2, 30, 60, 120, 180, 300.
Manage user-supplied GeoIP / GeoSite source files. All endpoints under /panel/api/custom-geo.

GET
/panel/api/custom-geo/list
List configured custom geo sources with their type, alias, URL, status, and last-download timestamp.

GET
/panel/api/custom-geo/aliases
List geo aliases currently usable in routing rules — both built-in defaults and the user-configured ones.

POST
/panel/api/custom-geo/add
Register a custom geo source. Alias is auto-normalised; URL must point to a .dat / .json blob.

Request body
JSON

{
  "type": "geoip",
  "alias": "myips",
  "url": "https://example.com/geo/my.dat"
}
POST
/panel/api/custom-geo/update/:id
Replace a custom geo source. Same body shape as /add.

Parameters
Name	In	Type	Description
id	path	number	Custom geo source ID.
POST
/panel/api/custom-geo/delete/:id
Remove a custom geo source and its cached file.

Parameters
Name	In	Type	Description
id	path	number	Custom geo source ID.
POST
/panel/api/custom-geo/download/:id
Re-download one custom geo source on demand.

Parameters
Name	In	Type	Description
id	path	number	Custom geo source ID.
POST
/panel/api/custom-geo/update-all
Re-download every configured custom geo source. Errors are reported per-source in the response.

Operations that interact with the configured Telegram bot.

POST
/panel/api/backuptotgbot
Send a fresh DB backup to every Telegram chat configured as an admin recipient. No body, no params.

Panel configuration and user credentials. All endpoints live under /panel/setting and require a logged-in session or Bearer token.

POST
/panel/setting/all
Return every panel setting: web server, Telegram bot, subscription, security, LDAP. The full JSON blob that the Settings page edits.

Response
JSON

{
  "success": true,
  "obj": {
    "webPort": 2053,
    "webCertFile": "",
    "webKeyFile": "",
    "webBasePath": "/",
    "subPort": 10882,
    "subPath": "/sub/",
    "tgBotEnable": false,
    "tgBotToken": "",
    ...
  }
}
POST
/panel/setting/defaultSettings
Return the computed default settings based on the request host. Useful to preview what a fresh install would use.

POST
/panel/setting/update
Persist every setting at once. The body mirrors the shape returned by /all. Invalid values (bad ports, missing cert pairs, etc.) are rejected before write.

Request body
JSON

{
  "webPort": 2053,
  "webBasePath": "/",
  "subPort": 10882,
  "subPath": "/sub/",
  "tgBotEnable": false,
  ...
}
POST
/panel/setting/updateUser
Change the panel admin username and password. Requires the current credentials for verification. The session is refreshed with the new values on success.

Parameters
Name	In	Type	Description
oldUsername	body	string	Current admin username.
oldPassword	body	string	Current admin password.
newUsername	body	string	Desired new username.
newPassword	body	string	Desired new password.
Request body
JSON

{
  "oldUsername": "admin",
  "oldPassword": "admin",
  "newUsername": "newadmin",
  "newPassword": "newpass"
}
POST
/panel/setting/restartPanel
Restart the entire 3x-ui process after a 3-second grace period. The connection drops immediately; the panel comes back online ~5-10 seconds later.

GET
/panel/setting/getDefaultJsonConfig
Return the built-in default Xray JSON config template that ships with this panel version.

Manage Bearer tokens used for programmatic auth (bots, central panels acting on this node, CI). Each token has a unique name and an enabled flag — disable to revoke without deleting, delete to revoke permanently. Tokens are stored plaintext so the SPA can show them on demand. Send one as Authorization: Bearer &lt;token&gt; on any /panel/api/* request.

GET
/panel/setting/apiTokens
List every API token, enabled or not.

Response
JSON

{
  "success": true,
  "obj": [
    {
      "id": 1,
      "name": "default",
      "token": "abcdef-12345-...",
      "enabled": true,
      "createdAt": 1736000000
    }
  ]
}
POST
/panel/setting/apiTokens/create
Mint a new API token. Name must be unique and 1-64 characters; the token string is server-generated.

Parameters
Name	In	Type	Description
name	body	string	Human-readable label, e.g. "central-panel-a".
Request body
JSON

{
  "name": "central-panel-a"
}
Response
JSON

{
  "success": true,
  "obj": {
    "id": 2,
    "name": "central-panel-a",
    "token": "new-token-string",
    "enabled": true,
    "createdAt": 1736000000
  }
}
Error response
JSON

{
  "success": false,
  "msg": "a token with that name already exists"
}
POST
/panel/setting/apiTokens/delete/:id
Permanently delete a token. Any caller using it stops authenticating immediately.

Parameters
Name	In	Type	Description
id	path	number	Token row ID.
Response
JSON

{
  "success": true
}
POST
/panel/setting/apiTokens/setEnabled/:id
Toggle a token enabled/disabled without deleting it. Disabled tokens are rejected by checkAPIAuth on the next request.

Parameters
Name	In	Type	Description
id	path	number	Token row ID.
enabled	body	boolean	New enabled state.
Request body
JSON

{
  "enabled": false
}
Response
JSON

{
  "success": true
}
Xray configuration template, outbound management, Warp/Nord integration, and config testing. All endpoints under /panel/xray.

POST
/panel/xray/
Return the Xray config template (JSON string), available inbound tags, client reverse tags, and the configured outbound test URL in one response.

Response
JSON

{
  "success": true,
  "obj": {
    "xraySetting": "{...raw xray config...}",
    "inboundTags": "[\"inbound-443\"]",
    "clientReverseTags": "[]",
    "outboundTestUrl": "https://www.google.com/generate_204"
  }
}
GET
/panel/xray/getDefaultJsonConfig
Return the built-in default Xray config shipped with the panel (identical to /panel/setting/getDefaultJsonConfig).

GET
/panel/xray/getOutboundsTraffic
Return traffic statistics for every outbound. Each outbound shows up/down/total counters.

GET
/panel/xray/getXrayResult
Return the most recent Xray process stdout/stderr output. Useful to check for startup errors or runtime warnings.

POST
/panel/xray/update
Save the Xray JSON config template and optionally the outbound test URL. Both are sent as form fields.

Parameters
Name	In	Type	Description
xraySetting	body (form)	string	Full Xray JSON config template.
outboundTestUrl	body (form)	string	URL used for outbound reachability tests. Defaults to https://www.google.com/generate_204.
POST
/panel/xray/warp/:action
Manage Cloudflare Warp integration. The action parameter selects the operation.

Parameters
Name	In	Type	Description
action	path	string	data — return Warp stats (quota, remaining). del — delete Warp data. config — return current Warp config. reg — register a new Warp endpoint (sends privateKey, publicKey). license — set a Warp+ license key (sends license).
privateKey	body (form)	string	Required when action=reg.
publicKey	body (form)	string	Required when action=reg.
license	body (form)	string	Required when action=license.
POST
/panel/xray/nord/:action
Manage NordVPN integration. The action parameter selects the operation.

Parameters
Name	In	Type	Description
action	path	string	countries — list available countries. servers — list servers in a country (sends countryId). reg — get NordVPN credentials (sends token). setKey — store NordVPN API key (sends key). data — return current NordVPN connection data. del — delete NordVPN data.
countryId	body (form)	string	Required when action=servers.
token	body (form)	string	Required when action=reg.
key	body (form)	string	Required when action=setKey.
POST
/panel/xray/resetOutboundsTraffic
Reset traffic counters for a specific outbound by tag.

Parameters
Name	In	Type	Description
tag	body (form)	string	Outbound tag to reset (e.g. "proxy", "direct").
Request body
JSON

tag=proxy
POST
/panel/xray/testOutbound
Test an outbound configuration. Sends the outbound JSON (required), optionally all outbounds (to resolve sockopt.dialerProxy dependencies), and a mode flag.

Parameters
Name	In	Type	Description
outbound	body (form)	string	JSON-encoded single outbound to test (required).
allOutbounds	body (form)	string	JSON array of all outbounds — used to resolve dialerProxy chains.
mode	body (form)	string	"tcp" for a fast dial-only probe (parallel-safe). Default/empty uses a full HTTP probe through a temp xray instance.
Request body
JSON

outbound={"protocol":"freedom","settings":{}}&mode=tcp
A separate HTTP/HTTPS server that serves proxy subscription links (standard, JSON, and Clash) to clients. The server listens on its own port (default 10882) and is configured in Settings → Subscription. Paths are configurable; defaults are shown below. All subscription endpoints set response headers for client apps to read traffic/expiry info.

Response headers
Header	Description
Subscription-Userinfo	Traffic and expiry: upload=N; download=N; total=N; expire=TS
Profile-Title	Base64-encoded subscription display name
Profile-Web-Page-Url	Link to the subscription info page
Support-Url	Support contact URL configured in settings
Profile-Update-Interval	Suggested polling interval in minutes (e.g. 10)
Announce	Base64-encoded announcement string
Routing-Enable	true or false — whether routing rules are included
Routing	Global routing rules for client apps that support them (e.g. Happ)
GET
/{subPath}:subid
Return base64-encoded subscription links for all enabled clients matching the subscription ID. When the request has an Accept: text/html header or ?html=1, renders a styled info page instead. Default path: /sub/:subid.

Parameters
Name	In	Type	Description
subid	path	string	Client subscription ID.
GET
/{jsonPath}:subid
Return subscription as a JSON array of proxy configs (one per enabled client). Only when JSON subscription is enabled in settings. Default path: /json/:subid.

Parameters
Name	In	Type	Description
subid	path	string	Client subscription ID.
GET
/{clashPath}:subid
Return subscription as a Clash/Mihomo-compatible YAML config. Only when Clash subscription is enabled in settings. Default path: /clash/:subid.

Parameters
Name	In	Type	Description
subid	path	string	Client subscription ID.
Real-time status updates via WebSocket. Connect once at ws://<panel>/ws to receive a stream of JSON messages without polling. Requires an authenticated session cookie (Bearer token auth is not supported). Each message has a type field that identifies the payload shape.

GET
/ws
Upgrade an HTTP connection to a WebSocket. Requires an authenticated session cookie (Bearer token auth is not supported here). Returns 101 Switching Protocols on success. The server then pushes JSON messages described below.

WS
→ type: status
Server health snapshot pushed every 2 seconds. Contains CPU, memory, swap, disk, network IO, load, and Xray state — same shape as GET /panel/api/server/status.

Response
JSON

{
  "type": "status",
  "data": { "cpu": 12.5, "mem": { "current": 2147483648, "total": 8589934592 }, "xray": { "state": "running" } }
}
WS
→ type: xrayState
Xray process state change. Fired when Xray starts, stops, or encounters an error.

Response
JSON

{
  "type": "xrayState",
  "data": "running"
}
WS
→ type: notification
In-panel toast notification. Fired on Xray stop/restart, DB import, panel restart, etc.

Response
JSON

{
  "type": "notification",
  "title": "Xray service restarted",
  "body": "Xray has been restarted successfully",
  "severity": "success"
}
WS
→ type: invalidate
Instructs the UI to re-fetch a resource. Fired when another admin session modifies data (e.g. toggling inbound enable).

Response
JSON

{
  "type": "invalidate",
  "resource": "inbounds"
}