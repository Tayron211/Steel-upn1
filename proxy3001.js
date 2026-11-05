const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(302, { 'Location': 'http://localhost:8000' + req.url });
  res.end();
});

server.listen(3001, '0.0.0.0', () => {
  console.log('[PORT REDIRECT] http://localhost:3001 -> http://localhost:8000');
});

