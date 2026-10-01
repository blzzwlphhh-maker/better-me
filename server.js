'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
const port = Number(process.env.PORT || 3000);
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = files[pathname];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, file[0]), (error, content) => {
    if (error) { res.writeHead(500); return res.end('Unable to read file'); }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});
server.on('error', error => { console.error(`无法启动服务：${error.message}`); process.exit(1); });
server.listen(port, '0.0.0.0', () => { console.log(`Better Me: http://localhost:${port}`); for (const list of Object.values(require('node:os').networkInterfaces())) for (const address of list || []) if (address.family === 'IPv4' && !address.internal) console.log(`同一 Wi-Fi 手机访问: http://${address.address}:${port}`); });
