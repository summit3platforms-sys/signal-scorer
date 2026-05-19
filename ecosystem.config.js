module.exports = {
  apps: [
    {
      name: 'signal-scorer',
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',

      // Environment
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },

      // Memory & restart policy
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',

      // Logging
      out_file: '/var/log/signal-scorer/out.log',
      error_file: '/var/log/signal-scorer/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss IST',

      // Never watch files in production — cron + WebSocket must not restart mid-tick
      watch: false,

      // Graceful shutdown — lets WebSocket and SQLite close cleanly
      kill_timeout: 5000,
      listen_timeout: 10000,

      // Node.js runtime flags for production
      node_args: '--max-old-space-size=512'
    }
  ]
};
