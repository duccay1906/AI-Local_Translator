/**
 * Zero-dependency LAN Update Server for AI Local Translator
 * 
 * Serves the `updates/` directory over HTTP on port 8080 (or process.env.PORT)
 * Allows client apps across the LAN to check version.json and download .exe updates.
 * 
 * Usage:
 *   node scripts/serve-updates.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT || '8080', 10);
const UPDATES_DIR = path.resolve(__dirname, '../updates');

// Ensure updates directory exists
if (!fs.existsSync(UPDATES_DIR)) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

// Ensure default version.json exists if directory is fresh
const defaultManifestPath = path.join(UPDATES_DIR, 'version.json');
if (!fs.existsSync(defaultManifestPath)) {
  const pkg = require('../package.json');
  const initialManifest = {
    version: pkg.version || '1.0.1',
    releaseDate: new Date().toISOString().split('T')[0],
    downloadUrl: '',
    releaseNotes: 'Initial release with LAN update support.'
  };
  fs.writeFileSync(defaultManifestPath, JSON.stringify(initialManifest, null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  // CORS Headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse path
  let reqPath = decodeURI(req.url.split('?')[0]);
  
  // Support both /updates/filename and /filename
  if (reqPath.startsWith('/updates/')) {
    reqPath = reqPath.replace(/^\/updates/, '');
  } else if (reqPath === '/updates') {
    reqPath = '/version.json';
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/version.json';
  }

  const filePath = path.normalize(path.join(UPDATES_DIR, reqPath));

  // Security check to avoid path traversal
  if (!filePath.startsWith(UPDATES_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support HTTP Range requests for resumable large downloads
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${reqPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB) -> ${clientIp}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('='.repeat(65));
  console.log(`🚀 AI Local Translator - LAN Update Server running on port ${PORT}`);
  console.log(`📁 Serving directory: ${UPDATES_DIR}`);
  console.log('='.repeat(65));
  console.log('LAN Access URLs:');
  ips.forEach((ip) => {
    console.log(`   ➜ http://${ip}:${PORT}/updates/version.json`);
  });
  console.log('='.repeat(65));
  console.log('Press Ctrl+C to stop the server.\n');
});
