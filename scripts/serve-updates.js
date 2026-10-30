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

  // Check if browser requested the root page or download portal via HTML
  const isHtmlRequest = (req.headers.accept && req.headers.accept.includes('text/html')) ||
    reqPath === '/' || reqPath === '/index.html' || reqPath === '/download';

  if (isHtmlRequest && (reqPath === '/' || reqPath === '/index.html' || reqPath === '/download' || reqPath === '')) {
    let manifest = { version: '1.0.9', releaseNotes: 'Latest update', installerUrl: '', portableUrl: '' };
    try {
      if (fs.existsSync(defaultManifestPath)) {
        manifest = JSON.parse(fs.readFileSync(defaultManifestPath, 'utf8'));
      }
    } catch (e) {}

    const installerLink = manifest.installerUrl ? `/updates/${encodeURIComponent(manifest.installerUrl)}` : '#';
    const portableLink = manifest.portableUrl ? `/updates/${encodeURIComponent(manifest.portableUrl)}` : '#';
    const releaseNotesHtml = (manifest.releaseNotes || 'No notes.')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Local Translator - Tải & Cập nhật Nội bộ</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f19;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(18, 24, 38, 0.95);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.15);
      max-width: 580px;
      width: 100%;
      padding: 36px 32px;
      backdrop-filter: blur(16px);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .icon-box {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      line-height: 1.2;
    }
    .badge {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 10px;
      border-radius: 20px;
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
      font-size: 12px;
      font-weight: 600;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      margin-top: 14px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }
    .btn-secondary {
      background: rgba(30, 41, 59, 0.8);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(51, 65, 85, 0.9);
      color: #fff;
      transform: translateY(-1px);
    }
    .notes-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px;
      margin-top: 24px;
      font-size: 12px;
      line-height: 1.6;
      color: #94a3b8;
    }
    .notes-title {
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 6px;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .footer {
      margin-top: 24px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon-box">✨</div>
      <div>
        <h1>AI Local Translator</h1>
        <div class="badge">Phiên bản mới nhất: v${manifest.version}</div>
      </div>
    </div>

    <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5;">
      Tải và cập nhật trực tiếp cho các máy trong mạng LAN. Nhấn nút bên dưới để tải và nâng cấp ngay:
    </p>

    <a href="${installerLink}" class="btn btn-primary">
      🚀 Tải Bộ Cài Đặt Setup (Khuyên dùng)
    </a>

    <a href="${portableLink}" class="btn btn-secondary">
      📦 Tải Bản Portable (Không cần cài đặt)
    </a>

    <div class="notes-box">
      <div class="notes-title">Thông tin cập nhật v${manifest.version}:</div>
      <div>${releaseNotesHtml}</div>
    </div>

    <div class="footer">
      Máy chủ LAN: <code>http://192.168.1.12:8080/updates</code><br/>
      Phát triển bởi XavisTech • Cập nhật nội bộ ổn định
    </div>
  </div>
</body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
      'Cache-Control': 'no-cache',
    });
    res.end(html);
    return;
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
