import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultDistDir = path.join(repoRoot, 'fx-parent-pom', 'fx-trading-ui', 'fx-trading-app', 'dist');

const host = process.env.UI_STATIC_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.UI_STATIC_PORT || '5173', 10);
const distDir = path.resolve(process.env.UI_DIST_DIR || defaultDistDir);
const indexFile = path.join(distDir, 'index.html');
const authApiTarget = process.env.AUTH_API_PROXY_TARGET || 'http://localhost:8080';
const pricingApiTarget = process.env.PRICING_API_PROXY_TARGET || 'http://localhost:8081';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function log(level, message) {
  console.log(`[${new Date().toISOString()}] [${level}] ${message}`);
}

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function proxyRequest(request, response, targetBase, pathPrefix, rewritePrefix) {
  const startedAt = Date.now();
  const method = request.method || 'GET';
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `localhost:${port}`}`);
  const upstreamUrl = new URL(targetBase);
  upstreamUrl.pathname = requestUrl.pathname.replace(pathPrefix, rewritePrefix) || rewritePrefix;
  upstreamUrl.search = requestUrl.search;

  const headers = new Headers();
  Object.entries(request.headers).forEach(([key, value]) => {
    if (typeof value === 'string') {
      headers.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    }
  });

  headers.set('host', upstreamUrl.host);

  const requestBody = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body: requestBody,
      redirect: 'manual',
    });

    const responseHeaders = {};
    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        responseHeaders[key] = value;
      }
    });

    response.writeHead(upstreamResponse.status, responseHeaders);

    if (upstreamResponse.body) {
      const bodyBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
      response.end(bodyBuffer);
    } else {
      response.end();
    }

    const duration = Date.now() - startedAt;
    log('INFO', `${method} ${requestUrl.pathname} -> ${upstreamResponse.status} proxied to ${upstreamUrl.origin}${upstreamUrl.pathname} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startedAt;
    log('ERROR', `${method} ${requestUrl.pathname} -> 502 proxy failure to ${upstreamUrl.origin}${upstreamUrl.pathname} (${duration}ms) ${error.message}`);
    sendError(response, 502, 'Bad Gateway');
  }
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function directoryExists(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

if (!directoryExists(distDir)) {
  log('ERROR', `Dist directory does not exist: ${distDir}`);
  process.exit(1);
}

if (!fileExists(indexFile)) {
  log('ERROR', `SPA entry file is missing: ${indexFile}`);
  process.exit(1);
}

const server = http.createServer(async (request, response) => {
  const startedAt = Date.now();
  const method = request.method || 'GET';
  const rawUrl = request.url || '/';
  const requestUrl = new URL(rawUrl, `http://${request.headers.host || `localhost:${port}`}`);
  const decodedPath = decodeURIComponent(requestUrl.pathname);

  if (decodedPath.startsWith('/auth-api/')) {
    await proxyRequest(request, response, authApiTarget, '/auth-api', '/api');
    return;
  }

  if (decodedPath.startsWith('/pricing-api/')) {
    await proxyRequest(request, response, pricingApiTarget, '/pricing-api', '/api');
    return;
  }

  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const safePath = path.normalize(normalizedPath).replace(/^([.][.][/\\])+/, '');
  let targetPath = path.join(distDir, safePath);

  if (!targetPath.startsWith(distDir)) {
    log('WARN', `${method} ${decodedPath} -> 403 path traversal blocked`);
    sendError(response, 403, 'Forbidden');
    return;
  }

  if (!fileExists(targetPath)) {
    targetPath = indexFile;
  }

  fs.stat(targetPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      const duration = Date.now() - startedAt;
      log('WARN', `${method} ${decodedPath} -> 404 (${duration}ms)`);
      sendError(response, 404, 'Not Found');
      return;
    }

    const extension = path.extname(targetPath).toLowerCase();
    const contentType = mimeTypes[extension] || 'application/octet-stream';

    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': targetPath === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable',
    });

    const stream = fs.createReadStream(targetPath);
    stream.on('error', (streamError) => {
      const duration = Date.now() - startedAt;
      log('ERROR', `${method} ${decodedPath} -> 500 (${duration}ms) ${streamError.message}`);
      if (!response.headersSent) {
        sendError(response, 500, 'Internal Server Error');
      } else {
        response.destroy(streamError);
      }
    });

    response.on('finish', () => {
      const duration = Date.now() - startedAt;
      const relativeFile = path.relative(distDir, targetPath) || 'index.html';
      log('INFO', `${method} ${decodedPath} -> ${response.statusCode} ${relativeFile} (${duration}ms)`);
    });

    stream.pipe(response);
  });
});

server.on('clientError', (error, socket) => {
  log('WARN', `Client error: ${error.message}`);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(port, host, () => {
  log('INFO', `Serving built UI from ${distDir}`);
  log('INFO', `Static server listening on http://${host}:${port}`);
});

