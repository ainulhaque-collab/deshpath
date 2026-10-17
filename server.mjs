import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.DESH_PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async (req,res) => {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  try {
    const url = new URL(req.url,'http://localhost');
    let pathname;
    try { pathname=decodeURIComponent(url.pathname); } catch {res.writeHead(400);res.end('Bad request');return;}
    const requested=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
    if(requested.split(/[\\/]/).some(part=>part.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
    const filename=path.resolve(root,requested);
    if(!filename.startsWith(root+path.sep)&&filename!==path.join(root,'index.html')){res.writeHead(403);res.end('Forbidden');return;}
    const info=await stat(filename);if(!info.isFile())throw Object.assign(new Error('Not found'),{code:'ENOENT'});
    const type=mime[path.extname(filename)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    if(req.method==='HEAD')res.end();else res.end(await readFile(filename));
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});res.end(error.code==='ENOENT'?'এই পাতা পাওয়া যায়নি।':'পাতাটি খুলতে সমস্যা হয়েছে।');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Set DESH_PORT to another port.`:error);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`দেশপথ is ready: http://localhost:${server.address().port}\nServing local files from ${root}`));
