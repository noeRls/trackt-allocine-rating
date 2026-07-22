import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8080;
const FILE_PATH = path.resolve('dist/allocine-rating-on-trakt.user.js');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  
  if (fs.existsSync(FILE_PATH)) {
    const content = fs.readFileSync(FILE_PATH);
    res.writeHead(200);
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('File not found');
  }
});

server.listen(PORT, () => {
  console.log(`[Userscript Server] Running at http://localhost:${PORT}/allocine-rating-on-trakt.user.js`);
});
