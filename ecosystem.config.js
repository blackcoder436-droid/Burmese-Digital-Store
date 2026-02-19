module.exports = {
  apps: [
    {
      name: 'burmese-digital-store',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/www/burmese-digital-store',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    // ---- Cron Jobs ----
    {
      name: 'cron-expire-orders',
      script: 'scripts/cron-runner.sh',
      args: '/api/cron/expire-orders',
      cwd: '/var/www/burmese-digital-store',
      cron_restart: '*/5 * * * *', // Every 5 minutes
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'cron-vpn-expiry-reminders',
      script: 'scripts/cron-runner.sh',
      args: '/api/cron/vpn-expiry-reminders',
      cwd: '/var/www/burmese-digital-store',
      cron_restart: '0 9 * * *', // Daily at 9:00 AM
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
