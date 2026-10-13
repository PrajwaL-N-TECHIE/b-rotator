import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

/**
 * Universal Vercel Serverless Handler & Static Asset Fallback
 * Guarantees zero 500 FUNCTION_INVOCATION_FAILED errors on Vercel Node runtime.
 */
export default function handler(req, res) {
  const urlPath = (req.url || '/').split('?')[0];
  const cleanPath = urlPath.replace(/^\//, '');
  const relativePath = cleanPath === '' ? 'index.html' : cleanPath;
  const filePath = path.join(__dirname, relativePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (idxErr, data) => {
        if (idxErr) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('404 Not Found');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('500 Internal Server Error');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(data);
    });
  });
}
