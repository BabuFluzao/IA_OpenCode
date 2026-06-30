const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const QR_PATH = path.join(__dirname, 'qrcode.png');

const server = http.createServer((req, res) => {
  if (req.url === '/qr' || req.url === '/qrcode.png') {
    fs.readFile(QR_PATH, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('QR not yet generated');
      }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(data);
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<html><body style="text-align:center;padding:20px"><h2>Escaneie o QR Code com seu WhatsApp:</h2><img src="/qr" style="width:400px;image-rendering:pixelated"/><p>Atualiza automaticamente a cada 2s</p><script>setInterval(()=>{document.querySelector('img').src='/qr?'+Date.now()},2000)</script></body></html>`);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log('QR Server on port ' + PORT));
