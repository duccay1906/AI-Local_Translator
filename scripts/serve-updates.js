/**
 * Zero-dependency LAN Web & Update Server for AI Local Translator
 * 
 * Serves:
 * 1. Complete Product Website & Documentation (from `web/`)
 * 2. Update binaries and version.json (from `updates/`)
 * 
 * Port: 8080 (or process.env.PORT)
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
const WEB_DIR = path.resolve(__dirname, '../web');

// Ensure updates directory exists
if (!fs.existsSync(UPDATES_DIR)) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

// Ensure default version.json exists if directory is fresh
const defaultManifestPath = path.join(UPDATES_DIR, 'version.json');
if (!fs.existsSync(defaultManifestPath)) {
  const pkg = require('../package.json');
  const initialManifest = {
    version: pkg.version || '1.0.9',
    releaseDate: new Date().toISOString().split('T')[0],
    downloadUrl: 'AI_Local_Translator_Setup_1.0.9.exe',
    installerUrl: 'AI_Local_Translator_Setup_1.0.9.exe',
    portableUrl: 'AI_Local_Translator_1.0.9.exe',
    releaseNotes: 'Native Windows Shell Auto-Updater & Full Product Documentation Portal.',
  };
  fs.writeFileSync(defaultManifestPath, JSON.stringify(initialManifest, null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
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

function serveFileWithRange(filePath, req, res) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support HTTP Range requests for resumable downloads
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
      'Cache-Control': ext === '.json' ? 'no-cache' : 'public, max-age=3600',
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });
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

  // 1. Root and Website Documentation (/ or /index.html)
  if (reqPath === '/' || reqPath === '/index.html' || reqPath === '/docs') {
    const indexPath = path.join(WEB_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveFileWithRange(indexPath, req, res);
      return;
    }
  }

  // 2. Static Web Assets (/css/*, /js/*, /img/*, /favicon.ico)
  if (reqPath.startsWith('/css/') || reqPath.startsWith('/js/') || reqPath.startsWith('/img/') || reqPath === '/favicon.ico') {
    const assetPath = path.normalize(path.join(WEB_DIR, reqPath === '/favicon.ico' ? 'img/icon.png' : reqPath));
    if (assetPath.startsWith(WEB_DIR) && fs.existsSync(assetPath)) {
      serveFileWithRange(assetPath, req, res);
      return;
    }
  }

  // 3. Application Update Manifest & Binaries (/updates/* or /version.json)
  if (reqPath.startsWith('/updates/')) {
    reqPath = reqPath.replace(/^\/updates/, '');
  } else if (reqPath === '/updates') {
    reqPath = '/version.json';
  }

  if (reqPath === '') {
    reqPath = '/version.json';
  }

  const updateFilePath = path.normalize(path.join(UPDATES_DIR, reqPath));
  if (!updateFilePath.startsWith(UPDATES_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  serveFileWithRange(updateFilePath, req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('='.repeat(65));
  console.log(`🚀 AI Local Translator - Web Portal & LAN Server running on port ${PORT}`);
  console.log(`🌐 Website URL:        http://192.168.1.12:${PORT}/`);
  console.log(`📦 Updates Manifest:   http://192.168.1.12:${PORT}/updates/version.json`);
  console.log('='.repeat(65));
  console.log('LAN Access URLs:');
  ips.forEach((ip) => {
    console.log(`   ➜ Web Portal:     http://${ip}:${PORT}/`);
    console.log(`   ➜ Update API:     http://${ip}:${PORT}/updates/version.json`);
  });
  console.log('='.repeat(65));
  console.log('Press Ctrl+C to stop the server.\n');
});
