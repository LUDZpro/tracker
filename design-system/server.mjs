import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = await realpath(resolve(fileURLToPath(new URL('.', import.meta.url))));
const PORT = Number(process.env.PORT || 4319);

const TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requested = pathname === '/' ? '/index.html' : pathname;
    let filePath = resolve(ROOT, `.${requested}`);

    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${sep}`)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    let info = await lstat(filePath);
    if (info.isDirectory()) filePath = resolve(filePath, 'index.html');

    info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    const canonicalPath = await realpath(filePath);
    if (canonicalPath !== ROOT && !canonicalPath.startsWith(`${ROOT}${sep}`)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    const canonicalInfo = await lstat(canonicalPath);
    if (!canonicalInfo.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const body = await readFile(canonicalPath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': TYPES.get(extname(canonicalPath)) || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch (error) {
    const status = error && error.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Not found' : 'Server error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Tracker design system: http://127.0.0.1:${PORT}`);
});
