module.exports = {
  apps: [
    {
      name: 'leaierp-api',
      script: 'apps/server/dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_memory_restart: '512M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      listen_timeout: 10000,
      kill_timeout: 5000
    }
  ]
}
