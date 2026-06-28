var h=require('http'),fs=require('fs'),p=require('path'),u=require('url');
var root=__dirname;
h.createServer(function(req,res){
  var pathname=u.parse(req.url).pathname;
  if(pathname==='/')pathname='/index.html';
  var filepath=p.join(root,pathname);
  fs.readFile(filepath,function(err,data){
    if(err){res.writeHead(404);res.end('Not Found')}
    else{
      var ext=p.extname(filepath);
      var ct={'html':'text/html','js':'application/javascript','css':'text/css','png':'image/png','jpg':'image/jpeg','svg':'image/svg+xml','ico':'image/x-icon','json':'application/json'}[ext.slice(1)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':ct});
      res.end(data)
    }
  })
}).listen(3000,function(){console.log('Segmentor server running on http://localhost:3000')});
