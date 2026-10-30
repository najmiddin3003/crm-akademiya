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
      // Tarmoq bayroqlari (30.10.2026, o'lchangan): api.telegram.org ga TCP ulanish ~100–250 ms, Node
      // esa sukut bo'yicha 250 ms dan keyin IPv4 urinishini yopib IPv6 ga o'tadi — serverda IPv6
      // yo'li yo'q, natija ETIMEDOUT: 40 ulanishdan 2–3 tasi uzilardi (bot javobi/xabari yo'qoladi).
      // Bayroqlar bilan 0/40.
      node_args: "--max-old-space-size=448 --no-network-family-autoselection --dns-result-order=ipv4first",
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
