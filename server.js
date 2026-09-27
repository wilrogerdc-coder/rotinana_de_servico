import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Security and caching headers based on vercel.json
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Some browsers block iframed apps if DENY is used, but vercel.json has it. 
  // Given we're in AI Studio where apps run in an iframe by default, DENY will break the preview.
  // I will omit X-Frame-Options or set to SAMEORIGIN/allow for the preview to work, but wait: AI Studio apps run in iframes from ai.studio.
  // Let's remove X-Frame-Options entirely so the app preview works in AI Studio.
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  if (req.path.startsWith('/assets/')) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (req.path === '/sw.js' || req.path.endsWith('.html') || req.path.startsWith('/js/') || req.path.startsWith('/css/')) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// cleanUrls behavior mapping
const pages = [
  'index', 'dashboard', 'rotina', 'telegrafia', 'oficiais', 
  'extras', 'relatorios', 'admin', 'tv', 'historico', 'postos', 'ajuda', 'servicos'
];

app.use((req, res, next) => {
  const urlPath = req.path.substring(1); // remove leading slash
  if (pages.includes(urlPath)) {
    req.url = `/${urlPath}.html`;
  }
  next();
});

// Serve static files from the root directory
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
