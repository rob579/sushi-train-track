// A small local web server that behaves like Cloudflare Pages for the things that matter to this app:
// /index.html and /x.html redirect to / and /x (Pages strips ".html"), and /.well-known/assetlinks.json
// is answered from /assetlinks.json (the _redirects rule). It serves the built folder, dist/.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./harness');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function start() {
  const dist = path.join(ROOT, 'dist');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/index.html') { res.writeHead(308, { Location: '/' }); return res.end(); }
    if (p.endsWith('.html')) { res.writeHead(308, { Location: p.slice(0, -5) }); return res.end(); }
    if (p === '/.well-known/assetlinks.json') p = '/assetlinks.json';
    if (p === '/') p = '/index.html';
    else if (!path.extname(p) && fs.existsSync(path.join(dist, p + '.html'))) p += '.html';
    const file = path.join(dist, path.normalize(p));
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, url: 'http://127.0.0.1:' + server.address().port })));
}
module.exports = { start };
