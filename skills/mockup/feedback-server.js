const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = parseInt(process.argv[3] || '3000', 10);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Feedback API
  if (pathname === '/__feedback') {
    const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.feedback.json'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(files));
  }

  if (pathname.startsWith('/__feedback/')) {
    const name = pathname.slice('/__feedback/'.length);
    const filePath = path.join(ROOT, `${name}.feedback.json`);

    if (req.method === 'POST') {
      const body = await readBody(req);
      fs.writeFileSync(filePath, body, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (req.method === 'GET') {
      if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
      const data = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(data);
    }
  }

  // Static file serving
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
});

server.listen(PORT, '127.0.0.1', () => {
  fs.writeFileSync(path.join(ROOT, '.feedback-server-pid'), String(process.pid));
  fs.writeFileSync(path.join(ROOT, '.feedback-server-port'), String(PORT));
  console.log(`Feedback server running at http://localhost:${PORT} (root: ${ROOT})`);
});
