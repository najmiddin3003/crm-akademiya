// pm2 — KICHIK MARKAZ SERVERI (1 GB, standalone to'plam; deploy/deploy-standalone.sh).
// Asosiy sayt ecosystem.config.cjs bilan (`next start`) — bu fayl unga tegmaydi.
// .env.local ni Next serverning o'zi o'qiydi (reliz papkasidagi havola).
module.exports = {
  apps: [
    {
      name: "crm",
      cwd: "/var/www/crm/current",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production", TZ: "UTC", PORT: "3000", HOSTNAME: "127.0.0.1" },
      node_args: "--max-old-space-size=448",
      max_memory_restart: "600M",
      kill_timeout: 8000,
      restart_delay: 2000,
      max_restarts: 10,
      time: true,
      merge_logs: true,
      out_file: "/var/www/crm/shared/logs/out.log",
      error_file: "/var/www/crm/shared/logs/err.log",
    },
  ],
};
