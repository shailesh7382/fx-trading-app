#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultDistDir = path.join(repoRoot, 'frontend', 'app', 'dist');

const host = process.env.UI_STATIC_HOST || '0.0.0.0';
const port = parsePositiveInteger('UI_STATIC_PORT', process.env.UI_STATIC_PORT || '5173', 65_535);
const proxyTimeoutMs = parsePositiveInteger(
  'BACKEND_API_PROXY_TIMEOUT_MS',
  process.env.BACKEND_API_PROXY_TIMEOUT_MS || '30000',
);
const distDir = path.resolve(process.env.UI_DIST_DIR || defaultDistDir);
const indexFile = path.join(distDir, 'index.html');
const backendApiTarget = parseBackendTarget(
  process.env.BACKEND_API_PROXY_TARGET || 'http://127.0.0.1:8080',
);

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

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

function fail(message) {
  log('ERROR', message);
  process.exit(1);
}

function parsePositiveInteger(name, rawValue, maximum = Number.MAX_SAFE_INTEGER) {
  if (!/^\d+$/.test(rawValue)) {
    fail(`${name} must be a positive integer; received ${JSON.stringify(rawValue)}`);
  }

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    fail(`${name} must be between 1 and ${maximum}; received ${JSON.stringify(rawValue)}`);
  }

  return value;
}

function parseBackendTarget(rawValue) {
  let target;
  try {
    target = new URL(rawValue);
  } catch {
    fail(`BACKEND_API_PROXY_TARGET is not a valid URL: ${JSON.stringify(rawValue)}`);
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    fail(`BACKEND_API_PROXY_TARGET must use http or https: ${JSON.stringify(rawValue)}`);
  }
  if (target.username || target.password) {
    fail('BACKEND_API_PROXY_TARGET must not contain credentials.');
  }

  target.search = '';
  target.hash = '';
  return target;
}

function sendError(response, statusCode, message) {
  if (response.headersSent) {
    response.destroy();
    return;
  }

  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(message);
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function directoryExists(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const connectionTokens = String(headers.connection || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const headerName of [...hopByHopHeaders, ...connectionTokens]) {
    delete sanitized[headerName];
  }

  return sanitized;
}

function upstreamUrlFor(requestUrl) {
  const upstreamUrl = new URL(backendApiTarget);
  const basePath = upstreamUrl.pathname === '/' ? '' : upstreamUrl.pathname.replace(/\/$/, '');
  upstreamUrl.pathname = `${basePath}${requestUrl.pathname}`;
  upstreamUrl.search = requestUrl.search;
  return upstreamUrl;
}

function proxyRequest(request, response, requestUrl) {
  const startedAt = Date.now();
  const method = request.method || 'GET';
  const upstreamUrl = upstreamUrlFor(requestUrl);
  const transport = upstreamUrl.protocol === 'https:' ? https : http;
  const headers = sanitizeHeaders(request.headers);
  headers.host = upstreamUrl.host;

  const upstreamRequest = transport.request(upstreamUrl, { method, headers }, (upstreamResponse) => {
    const responseHeaders = sanitizeHeaders(upstreamResponse.headers);
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);

    pipeline(upstreamResponse, response, (error) => {
      const duration = Date.now() - startedAt;
      if (error) {
        log('ERROR', `${method} ${requestUrl.pathname} -> proxy stream failed (${duration}ms): ${error.message}`);
        return;
      }

      log(
        'INFO',
        `${method} ${requestUrl.pathname} -> ${upstreamResponse.statusCode} proxied to ${upstreamUrl.origin}${upstreamUrl.pathname} (${duration}ms)`,
      );
    });
  });

  upstreamRequest.setTimeout(proxyTimeoutMs, () => {
    upstreamRequest.destroy(new Error(`upstream timed out after ${proxyTimeoutMs}ms`));
  });
  upstreamRequest.on('error', (error) => {
    const duration = Date.now() - startedAt;
    log('ERROR', `${method} ${requestUrl.pathname} -> 502 proxy failure (${duration}ms): ${error.message}`);
    sendError(response, 502, 'Bad Gateway');
  });
  request.on('aborted', () => upstreamRequest.destroy());
  request.pipe(upstreamRequest);
}

function resolveStaticPath(decodedPath) {
  if (decodedPath.includes('\0')) {
    return null;
  }

  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const targetPath = path.resolve(distDir, `.${requestedPath}`);
  const relativePath = path.relative(distDir, targetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return targetPath;
}

function serveStatic(request, response, requestUrl) {
  const startedAt = Date.now();
  const method = request.method || 'GET';

  if (!['GET', 'HEAD'].includes(method)) {
    response.setHeader('Allow', 'GET, HEAD');
    sendError(response, 405, 'Method Not Allowed');
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendError(response, 400, 'Bad Request');
    return;
  }

  let targetPath = resolveStaticPath(decodedPath);
  if (!targetPath) {
    log('WARN', `${method} ${requestUrl.pathname} -> 403 path traversal blocked`);
    sendError(response, 403, 'Forbidden');
    return;
  }

  if (!fileExists(targetPath)) {
    targetPath = indexFile;
  }

  fs.stat(targetPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      const duration = Date.now() - startedAt;
      log('WARN', `${method} ${requestUrl.pathname} -> 404 (${duration}ms)`);
      sendError(response, 404, 'Not Found');
      return;
    }

    const extension = path.extname(targetPath).toLowerCase();
    const contentType = mimeTypes[extension] || 'application/octet-stream';
    const relativeFile = path.relative(distDir, targetPath) || 'index.html';
    const cacheControl = relativeFile === 'index.html'
      ? 'no-cache'
      : relativeFile.startsWith(`assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';

    response.writeHead(200, {
      'Cache-Control': cacheControl,
      'Content-Length': stats.size,
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    });

    if (method === 'HEAD') {
      response.end();
      return;
    }

    const stream = fs.createReadStream(targetPath);
    stream.on('error', (error) => {
      const duration = Date.now() - startedAt;
      log('ERROR', `${method} ${requestUrl.pathname} -> 500 (${duration}ms): ${error.message}`);
      sendError(response, 500, 'Internal Server Error');
    });
    response.on('finish', () => {
      const duration = Date.now() - startedAt;
      log('INFO', `${method} ${requestUrl.pathname} -> ${response.statusCode} ${relativeFile} (${duration}ms)`);
    });
    stream.pipe(response);
  });
}

if (!directoryExists(distDir)) {
  fail(`Dist directory does not exist: ${distDir}`);
}
if (!fileExists(indexFile)) {
  fail(`SPA entry file is missing: ${indexFile}`);
}

const server = http.createServer((request, response) => {
  let requestUrl;
  try {
    requestUrl = new URL(request.url || '/', 'http://localhost');
  } catch {
    sendError(response, 400, 'Bad Request');
    return;
  }

  if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
    proxyRequest(request, response, requestUrl);
    return;
  }

  serveStatic(request, response, requestUrl);
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;

server.on('clientError', (error, socket) => {
  log('WARN', `Client error: ${error.message}`);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.on('error', (error) => {
  log('ERROR', `Static server failed: ${error.message}`);
  process.exitCode = 1;
});

function shutdown(signal) {
  log('INFO', `Received ${signal}; closing the static server.`);
  server.close((error) => {
    if (error) {
      log('ERROR', `Static server shutdown failed: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  });

  setTimeout(() => {
    log('ERROR', 'Static server did not close within 5 seconds.');
    process.exit(1);
  }, 5_000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

server.listen(port, host, () => {
  log('INFO', `Serving built UI from ${distDir}`);
  log('INFO', `Static server listening on http://${host}:${port}`);
  log('INFO', `Proxying /api to ${backendApiTarget.origin}${backendApiTarget.pathname}`);
});
