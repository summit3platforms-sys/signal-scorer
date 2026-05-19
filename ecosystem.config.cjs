module.exports = {
  apps: [{
    name: 'signal-scorer',
    script: 'server/index.js',
    cwd: '/opt/signal-scorer',
    node_args: '--experimental-modules',
    env: {
      NODE_ENV: 'production',
      PORT: 9000
    },
    // Restart policy
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    watch: false,
    // Memory management
    max_memory_restart: '512M',
    // Logging
    error_file: '/opt/signal-scorer/logs/error.log',
    out_file: '/opt/signal-scorer/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000
  }]
};
