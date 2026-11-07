const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8090;
const ROOT = __dirname;
const MIME = {'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const fp = path.join(ROOT,p);
  fs.readFile(fp,(err,data)=>{ if(err){res.writeHead(404);res.end('Not found: '+p);return;} res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream'});res.end(data);});
});
server.listen(PORT,()=>console.log('Cornel Trend Wave on http://localhost:'+PORT));