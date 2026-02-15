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
  ],
};
