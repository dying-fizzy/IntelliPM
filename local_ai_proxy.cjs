const http = require('http');

const PORT = 9000;
const OLLAMA_PORT = 11434;
const ML_PORT = 8000;

const server = http.createServer((req, res) => {
  let targetPort;
  let targetHost = '127.0.0.1';

  // Route logic
  if (req.url.startsWith('/api/generate') || req.url.startsWith('/api/chat')) {
    targetPort = OLLAMA_PORT;
    console.log(`[PROXY] Routing Task Generation (Ollama) -> :${OLLAMA_PORT}`);
  } else if (req.url.startsWith('/api/analyze-proposal')) {
    targetPort = ML_PORT;
    console.log(`[PROXY] Routing Risk Assessment (ML Service) -> :${ML_PORT}`);
  } else {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Create the proxy request
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  // Prevent CORS issues if called directly
  options.headers.host = `127.0.0.1:${targetPort}`;

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[PROXY ERROR] Failed to reach port ${targetPort}:`, err.message);
    res.writeHead(502);
    res.end('Bad Gateway: Local service not running.');
  });

  // Pipe the incoming request body to the proxy request
  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`
=============================================
🤖 LOCAL AI PROXY STARTED ON PORT ${PORT}
=============================================
Waiting for requests from Ngrok...
- Ollama traffic routes to port ${OLLAMA_PORT}
- ML Risk Analysis traffic routes to port ${ML_PORT}

Keep this window open while testing your live site!
=============================================
  `);
});
