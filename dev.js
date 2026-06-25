const { createServer } = require('node:http');
const handler = require('./api/webhook.js');

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    } catch {
      req.body = {};
    }
    handler(req, res);
  });
});

server.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
  console.log(`Webhook URL for ngrok: http://localhost:${PORT}/api/webhook`);
});
