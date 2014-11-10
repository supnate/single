/*
The MIT License (MIT)

Copyright (c) 2014 Nate Wang http://github.com/supnate/single.git

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

//Multiple sites config, example:
// var config = [{
//   location: 'e:/workspace'
//   ,port: 1337
// }, {
//   location: 'c:/workspace'
//   ,port: 1338
// }];
var config = [];

var http = require('http')
  ,fs = require('fs')
  ,util = require('util')
  ,path = require('path')
;

function Server() {}
Server.prototype = {
  port: 1337
  ,location: null  //root folder of the server site
  ,_httpServer: null
  ,start: function () {
    // summary:
    //  Start the server.

    this.location = this.location.replace(/^ +| +$/g, '');//trim
    if (!/\/$/.test(this.location)) {
      this.location = this.location + '/';
    }

    var self = this;

    try {
      this._httpServer = http.createServer(function (req, res){
        try{
          var absPath = self.mapPath(req.url);

          if (!fs.existsSync(absPath)) {
            //404: File not found.
            res.writeHead(200, {});
            res.write('404: file not found.', 'utf8');
            res.end();
            return;
          }
          if (fs.statSync(absPath).isDirectory()) {
            //List files of a directory
            self.dir(req, res);
            return;
          } else {
            var ext = path.extname(absPath).toLowerCase();
            self.file(req, res, ext);
            return;
          }
        } catch (e) {
          res.writeHead(500, {});
          res.write('500: internal server error.', 'utf8');
          res.end();
          console.log('error: ', e);
        }

      });

      this._httpServer.on('error', function (evt) {
        if (evt.code === 'EADDRINUSE') {
          console.log('Failed to start server at ' + self.location + ': port ' + self.port + ' has been in use.');
        } else {
          console.log('Failed to start server at ' + self.location + ', error: ', evt);
        }
      });

      this._httpServer.on('listening', function () {
        console.log('Server running at port ' + self.port + ': ' + self.location);
      });

      this._httpServer.listen(this.port);
    } catch (ex) {
      console.log('Failed to create server at ' + this.location);
    }
  }

  ,stop: function () {
    // summary:
    //  Stop the server.
    
    this.started = false;
    this._httpServer && this._httpServer.close();
    console.log('Server stopped at port ' + this.port);
    
  }

  ,file: function (req, res, ext) {
    // summary:
    //  Response file's content with the content-type based on file's extension
    fs.readFile(this.mapPath(req.url), 'binary', function(err,file){  
      res.writeHead(200,{  
          'Content-Type': TYPES[ext] || 'text/plain'
      });
      res.write(file, 'binary');  
      res.end();  
    });
  }

  ,dir: function (req, res) {
    // summary:
    //  Render the folder list.
    
    var rp = req.url, ap = this.mapPath(rp), self = this;

    fs.readdir(ap, function(error, files){
      files = files.map(function(file){
        var absPath = path.join(ap, file), s = fs.statSync(absPath);
        return {
          name: file + (s.isDirectory()? '/' : '')
          ,path: (rp + '/' + file).replace('//', '/')
          ,type: s.isDirectory() ? 'folder' : (/\./.test(file) ? file.split('.').pop() : '')
          ,size: s.isDirectory() ? '0KB' : (Math.round(s.size / 1000) + 'KB')
          ,lastModified: (s.mtime.getMonth() + 1) + '/' + s.mtime.getDate() + '/' + s.mtime.getFullYear() + ' ' + s.mtime.getHours() + ':' + s.mtime.getMinutes()
        };
      });
      files.sort(function(f1, f2){
        if(/\/$/.test(f1.name) && !/\/$/.test(f2.name)){return -1;}
        else if(/\/$/.test(f2.name) && !/\/$/.test(f1.name)){return 1;}
        else return f1.name > f2.name ? 1 : -1;
      });

      var a = '/', tp = rp;
      rp = '<a href="/">root</a> ' + rp.replace(/[^\/]+/g, function(s){
        a += (s + '/');
        return ' <a href="' + a + '">' + decodeURIComponent(s) + '</a> ';
      });

      var rows = files.map(function (file) {
        return [
          '<tr>'
          , '  <td><a href="', file.path, (file.type === 'folder' ? '/' : ''), '">', file.name, '</td>'
          , '  <td>', file.type, '</td>'
          , '  <td>', file.size, '</td>'
          , '  <td>', file.lastModified, '</td>'
          ,'</tr>'
        ].join('');
      }).join('');

      var context = {
        path: rp
        ,rows: rows
      };

      var html = dirPage.replace(/\{\{([^}]+)\}\}/g, function (m1, m2) {
        return context[m2];
      });
      res.write(html, 'utf8');
      res.end();
    });
  }

  ,mapPath: function (p) {
    // summary:
    //  Map the relative file path to the physical file path
    p = decodeURIComponent(p);
    p = path.join(this.location, p.replace(/^\/+/g, ''));
    return p;
  }
};

var args = process.argv, location, port;

if (args.length >= 4) {
  config = [{
    location: args[2]
    ,port: args[3]
  }];
}
if (!config.length) {
  console.log("No site config.");
} else {
  config.forEach(function (item) {
    var server = new Server();
    server.location = item.location;
    server.port = item.port;
    server.start();
  });
}

//Resources

var dirPage = '<html>\n\
<head>\n\
  <title>Index of {{title}}</title>\n\
  <style type="text/css">\n\
    body      {font-size: 12px; font-family: arial;}\n\
    h4        {font-size: 16px; font-family: arial; margin:20px; margin-bottom:5px; font-weight: bold;}\n\
    table     {border-collapse: collapse; margin-left: 20px;}\n\
    tr:hover  {background-color: #fffff0;}\n\
    tr:first-child:hover{background: none;}\n\
    th {\n\
      text-align: left;\n\
      cursor: default;\n\
      font-weight: bold;\n\
      padding: 6px 3px;\n\
      color: #555;\n\
      text-shadow: 0 1px 0 white;\n\
      border-bottom: 1px solid #D8D8D8;\n\
      background: #eee;\n\
      background: -moz-linear-gradient(#eee,#ddd);\n\
      background: -webkit-linear-gradient(#f6f6f6,#eee);\n\
    }\n\
    th, td         {font-size: 12px;font-family: arial;padding: 5px;padding-right: 30px;}\n\
    td             {color: #777;border-bottom: 1px solid #f0f0f0;}\n\
    td:first-child {padding-left: 24px; background: transparent url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAA6ElEQVQoFQXBMW5TQRgGwNnHnoE0QbiCjoIooUmTU3AuS1BwIoTSUdJBigg3GCWOg9/++zHTop078wIAsPMrE4SL5/1aIyMjIyMjz/m0tbFECFdrPeaQQw75mz/5nZH7fN7aWILmauSYfznmmIfss8vIUx7zZWsTTXM5vpWvTk5Wq9VHQP/gtgOLa0Qpw940vAQdaG6thpOhlOkG0AEuAVGmEkAH+G4YSikxXQM6wDsAMRFAB/ihDNNUmN4DOsAbBAEAdICfpmmaAt4COoj2GgCASbIkZh1NAACznhQt2itnFgAAlF3u/gMDtJXPzQxoswAAAABJRU5ErkJgggo=") no-repeat 5px 5px;}\n\
    .folder td:first-child  {padding-left: 24px; background: transparent url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABq0lEQVQ4y8WTu4oUQRSGv+rtGVuxhwVFdFEEE2c3d0HYTEMTn8DEVxADQTDUF9DMwMxQMBMx8AEWzRQ3cBHd9TI91+2urjq/QbczY2IygSep4nD+79yqnCRWsYQVbWVACvDh5ZXdrLe15dwyT1TjT/sxFFeB6i+VA2B6+cb7kAI4Jf0LO087zjlQI8Y5Qvnj0sHug321XoC1bk+K9eHk6+s7wPMUgKAS88eqb4+Jfg2SHs7lZBvX2Nh+2EUCDGSAcMnJsx9f7NxfAGqXyDzRd5EJO/pMPT1gcviGTnYOVIN5pAAE8v7dLrKL8xnglFk4ws9Afko9HpH3b5Gd2mwb/lOBmgrSdYhJugDUCenxM6xv3p4HCsP8F0LxCsUhCkMURihOyM7fg0osASTFEpu9a4LjGIUCqwcoDiEUrX+E4hRUQb20RiokC1j9vckUhygU7X3QZh7NAVKYL7YBeMkRUfjVCotF2XGIwnghtrJpMywB5G0QZj9P1JNujuWJ1AHLQadRrACPkuZ0SSSWpeStWgDK6tHek5vbiOs48n++XQHurcf0rFng//6NvwG+iB9/4duaTgAAAABJRU5ErkJgggo=") no-repeat 5px 4px;}\n\
    a, a:visited   {font-family: arial;text-decoration: none;color: #2175bc;}\n\
    a:hover        {color: red;text-decoration: underline;}\n\
    .footer        {font-style: italic; font-family: arial; color:#777; font-size: 12px; margin: 20px;}\n\
    .highlight     {background-color: #ffff99;}\n\
    #filterStatus  {color:#777;}\n\
    #tbFilter      {outline: none;margin-left: 20px; margin-bottom: 5px;width: 200px;}\n\
  </style>\n\
</head>\n\
<body>\n\
  <h4>Index of {{path}}</h4>\n\
  <div style="display: inline-block; width: 680px;">\n\
    <div style="text-align: right;">\n\
      <span id="filterStatus"></span>\n\
      <input id="tbFilter" placeholder="Filter"/>\n\
    </div>\n\
    <div id="gridContainer"><table>\n\
      <tr>\n\
        <th style="min-width: 300px">Name</th>\n\
        <th style="min-width: 60px">Type</th>\n\
        <th style="min-width: 60px">Size</th>\n\
        <th style="min-width: 100px">Last Modified</th>\n\
      </tr>\n\
      {{rows}}\n\
    </table>\n\
    </div>\n\
  </div>\n\
  <div class="footer"><hr/>Powered by Single, <a href="https://github.com/supnate/single">http://github.com/supnate/single</a></div>\n\
</body>\n\
</html>\n\
\n\
<script>' + 
"function $(id){  return document.getElementById(id);}\n\
function each(arr, callback){  for(var i = 0; i< arr.length; i++)callback(arr[i], i);}\n\
function clone(arr){  var arr2 = [];each(arr, function(s){arr2.push(s);});return arr2;}\n\
function stripHtml(s){  return s.replace(/<[^>]*>/g, '');}\n\
function fixEvent(evt){evt =  evt||event; if(!evt.target)evt.target = evt.srcElement;return evt;};\n\
\n\
var container = $('gridContainer'), grid = container.firstChild, data = [], sortData = {};\n\
\n\
$('tbFilter').value= '', $('tbFilter').focus();\n\
$('tbFilter').onkeyup = function(e){\n\
  e = e || window.event;\n\
  var target = e.target || e.srcElement;\n\
  if(e.keyCode == 13){\n\
    //press enter\n\
    if(!target.value)return;\n\
    if(/^\.\./.test(target.value) && document.location.pathname != '/'){\n\
      history.back();\n\
      return;\n\
    }\n\
    var a = grid.rows[1].cells[0].firstChild;\n\
    if(a && a.href)document.location = a.href;\n\
    \n\
  }else{\n\
    filter(target);\n\
  }\n\
}\n\
\n\
\n\
container.onclick = function(e){\n\
  e = fixEvent(e);\n\
  if(/th/i.test(e.target.tagName)){\n\
    sort(e.target.cellIndex);\n\
  }\n\
}\n\
each(grid.rows, function(row){  //init grid data\n\
  if(row.rowIndex <= 0)return;\n\
  var item = [];\n\
  each(row.cells, function(cell){item.push(cell.innerHTML);});\n\
  if(row.cells[1].innerHTML == 'folder')row.className = 'folder';\n\
  data.push(item);\n\
});\n\
function sort(col){\n\
  sortData = {col: col, desc: (sortData.col == col && !sortData.desc) ? true : false};\n\
  data.sort(function(a, b){\n\
    var v1 = stripHtml(a[col]), v2 = stripHtml(b[col]);\n\
    switch(col){\n\
      case 2:\n\
        v1 = parseInt(v1);\n\
        v2 = parseInt(v2);\n\
        break;\n\
      case 3:\n\
        v1 = new Date(v1);\n\
        v2 = new Date(v2);\n\
        break;\n\
    }\n\
    //folder always on top\n\
    if(a[1] == 'folder' && b[1] != 'folder')return -1;\n\
    if(b[1] == 'folder' && a[1] != 'folder')return 1;\n\
    //when sorting values are the same, always keep name ordered\n\
    if(v1 < v2)r = -1;\n\
    else if(v1 > v2)r = 1;\n\
    else return stripHtml(a[0]) <= stripHtml(b[0]) ? -1 : 1;\n\
    \n\
    return sortData.desc ? -r : r;\n\
  });\n\
  if($('tbFilter').value)filter();\n\
  else render(data);\n\
  //update sorting indicators\n\
  each(grid.rows[0].cells, function(cell){\n\
    cell.innerHTML = cell.innerHTML.replace(/ *[\\u2191\\u2193]$/g, '')\n\
      + (cell.cellIndex == sortData.col ? (sortData.desc ? ' \\u2191' : ' \\u2193') : '');\n\
  });\n\
}\n\
function filter(){\n\
  var s = $('tbFilter').value;\n\
  if(/^\\.\\./.test(s))s = '';\n\
  if(!s){\n\
    render(data);\n\
    $('filterStatus').innerHTML = '';\n\
  }else{\n\
    var arr = [];\n\
    each(data, function(item){\n\
      item = clone(item);\n\
      var rex = new RegExp('(' + s.replace(/\\./g, '\\\\.') + ')', 'ig');\n\
      if(rex.test(stripHtml(item.join(','))))arr.push(item);\n\
      each(item, function(c, i){//highlight search key\n\
        item[i] = stripHtml(c).replace(rex, '<span class=\"highlight\">$1</span>');\n\
      });\n\
      var href = (location.pathname + '/' + stripHtml(item[0])).replace(/\\/\\//g, '/');\n\
      item[0] = '<a href=\"' + href + '\"/>' + item[0] + '</a>';\n\
    });\n\
    render(arr);\n\
    $('filterStatus').innerHTML = arr.length + '/' + data.length;\n\
  }\n\
}\n\
function render(gridData){\n\
  var sb = [];\n\
  sb.push('<table><tr>', grid.rows[0].innerHTML, '</tr>');\n\
  each(gridData, function(rowData){\n\
    sb.push('<tr',(stripHtml(rowData[1]) == 'folder') ? ' class=\"folder\"': '','>');\n\
    each(rowData, function(cellData, i){\n\
      sb.push('<td>', cellData, '</td>');\n\
    });\n\
    sb.push('</tr>');\n\
  });\n\
  if(!gridData.length)sb.push('<tr><td colspan=\"4\" style=\"background:none; padding-left: 5px;\">No data.</td></tr>');\n\
  sb.push('</table>');\n\
  container.innerHTML = sb.join('');\n\
  grid = container.firstChild;\n\
}\n\
</script>";

var TYPES = {
  '.3gp'    : 'video/3gpp'  
  ,'title'  : 'hihii'
  ,'.a'     : 'application/octet-stream'  
  ,'.ai'    : 'application/postscript'  
  ,'.aif'   : 'audio/x-aiff'  
  ,'.aiff'  : 'audio/x-aiff'  
  ,'.asc'   : 'application/pgp-signature'  
  ,'.asf'   : 'video/x-ms-asf'  
  ,'.asm'   : 'text/x-asm'  
  ,'.asx'   : 'video/x-ms-asf'  
  ,'.atom'  : 'application/atom+xml'  
  ,'.au'    : 'audio/basic'  
  ,'.avi'   : 'video/x-msvideo'  
  ,'.bat'   : 'application/x-msdownload'  
  ,'.bin'   : 'application/octet-stream'  
  ,'.bmp'   : 'image/bmp'  
  ,'.bz2'   : 'application/x-bzip2'  
  ,'.c'     : 'text/x-c'  
  ,'.cab'   : 'application/vnd.ms-cab-compressed'  
  ,'.cc'    : 'text/x-c'  
  ,'.chm'   : 'application/vnd.ms-htmlhelp'  
  ,'.class' : 'application/octet-stream'  
  ,'.com'   : 'application/x-msdownload'  
  ,'.conf'  : 'text/plain'  
  ,'.cpp'   : 'text/x-c'  
  ,'.crt'   : 'application/x-x509-ca-cert'  
  ,'.css'   : 'text/css'  
  ,'.csv'   : 'text/csv'  
  ,'.cxx'   : 'text/x-c'  
  ,'.deb'   : 'application/x-debian-package'  
  ,'.der'   : 'application/x-x509-ca-cert'  
  ,'.diff'  : 'text/x-diff'  
  ,'.djv'   : 'image/vnd.djvu'  
  ,'.djvu'  : 'image/vnd.djvu'  
  ,'.dll'   : 'application/x-msdownload'  
  ,'.dmg'   : 'application/octet-stream'  
  ,'.doc'   : 'application/msword'  
  ,'.dot'   : 'application/msword'  
  ,'.dtd'   : 'application/xml-dtd'  
  ,'.dvi'   : 'application/x-dvi'  
  ,'.ear'   : 'application/java-archive'  
  ,'.eml'   : 'message/rfc822'  
  ,'.eps'   : 'application/postscript'  
  ,'.exe'   : 'application/x-msdownload'  
  ,'.f'     : 'text/x-fortran'  
  ,'.f77'   : 'text/x-fortran'  
  ,'.f90'   : 'text/x-fortran'  
  ,'.flv'   : 'video/x-flv'  
  ,'.for'   : 'text/x-fortran'  
  ,'.gem'   : 'application/octet-stream'  
  ,'.gemspec' : 'text/x-script.ruby'  
  ,'.gif'   : 'image/gif'  
  ,'.gz'    : 'application/x-gzip'  
  ,'.h'     : 'text/x-c'  
  ,'.hh'    : 'text/x-c'  
  ,'.htm'   : 'text/html'  
  ,'.html'  : 'text/html'  
  ,'.ico'   : 'image/vnd.microsoft.icon'  
  ,'.ics'   : 'text/calendar'  
  ,'.ifb'   : 'text/calendar'  
  ,'.iso'   : 'application/octet-stream'  
  ,'.jar'   : 'application/java-archive'  
  ,'.java'  : 'text/x-java-source'  
  ,'.jnlp'  : 'application/x-java-jnlp-file'  
  ,'.jpeg'  : 'image/jpeg'  
  ,'.jpg'   : 'image/jpeg'  
  ,'.js'    : 'application/javascript;charset=utf-8'  
  ,'.json'  : 'application/json'  
  ,'.log'   : 'text/plain;charset=utf-8'  
  ,'.m3u'   : 'audio/x-mpegurl'  
  ,'.m4v'   : 'video/mp4'  
  ,'.man'   : 'text/troff'  
  ,'.mathml': 'application/mathml+xml'  
  ,'.mbox'  : 'application/mbox'  
  ,'.mdoc'  : 'text/troff'  
  ,'.me'    : 'text/troff'  
  ,'.mid'   : 'audio/midi'  
  ,'.midi'  : 'audio/midi'  
  ,'.mime'  : 'message/rfc822'  
  ,'.mml'   : 'application/mathml+xml'  
  ,'.mng'   : 'video/x-mng'  
  ,'.mov'   : 'video/quicktime'  
  ,'.mp3'   : 'audio/mpeg'  
  ,'.mp4'   : 'video/mp4'  
  ,'.mp4v'  : 'video/mp4'  
  ,'.mpeg'  : 'video/mpeg'  
  ,'.mpg'   : 'video/mpeg'  
  ,'.ms'    : 'text/troff'  
  ,'.msi'   : 'application/x-msdownload'  
  ,'.odp'   : 'application/vnd.oasis.opendocument.presentation'  
  ,'.ods'   : 'application/vnd.oasis.opendocument.spreadsheet'  
  ,'.odt'   : 'application/vnd.oasis.opendocument.text'  
  ,'.ogg'   : 'application/ogg'  
  ,'.p'     : 'text/x-pascal'  
  ,'.pas'   : 'text/x-pascal'  
  ,'.pbm'   : 'image/x-portable-bitmap'  
  ,'.pdf'   : 'application/pdf'  
  ,'.pem'   : 'application/x-x509-ca-cert'  
  ,'.pgm'   : 'image/x-portable-graymap'  
  ,'.pgp'   : 'application/pgp-encrypted'  
  ,'.pkg'   : 'application/octet-stream'  
  ,'.pl'    : 'text/x-script.perl'  
  ,'.pm'    : 'text/x-script.perl-module'  
  ,'.png'   : 'image/png'  
  ,'.pnm'   : 'image/x-portable-anymap'  
  ,'.ppm'   : 'image/x-portable-pixmap'  
  ,'.pps'   : 'application/vnd.ms-powerpoint'  
  ,'.ppt'   : 'application/vnd.ms-powerpoint'  
  ,'.ps'    : 'application/postscript'  
  ,'.psd'   : 'image/vnd.adobe.photoshop'  
  ,'.py'    : 'text/x-script.python'  
  ,'.qt'    : 'video/quicktime'  
  ,'.ra'    : 'audio/x-pn-realaudio'  
  ,'.rake'  : 'text/x-script.ruby'  
  ,'.ram'   : 'audio/x-pn-realaudio'  
  ,'.rar'   : 'application/x-rar-compressed'  
  ,'.rb'    : 'text/x-script.ruby'  
  ,'.rdf'   : 'application/rdf+xml'  
  ,'.roff'  : 'text/troff'  
  ,'.rpm'   : 'application/x-redhat-package-manager'  
  ,'.rss'   : 'application/rss+xml'  
  ,'.rtf'   : 'application/rtf'  
  ,'.ru'    : 'text/x-script.ruby'  
  ,'.s'     : 'text/x-asm'  
  ,'.sgm'   : 'text/sgml'  
  ,'.sgml'  : 'text/sgml'  
  ,'.sh'    : 'application/x-sh'  
  ,'.sig'   : 'application/pgp-signature'  
  ,'.snd'   : 'audio/basic'  
  ,'.so'    : 'application/octet-stream'  
  ,'.svg'   : 'image/svg+xml'  
  ,'.svgz'  : 'image/svg+xml'  
  ,'.swf'   : 'application/x-shockwave-flash'  
  ,'.t'     : 'text/troff'  
  ,'.tar'   : 'application/x-tar'  
  ,'.tbz'   : 'application/x-bzip-compressed-tar'  
  ,'.tcl'   : 'application/x-tcl'  
  ,'.tex'   : 'application/x-tex'  
  ,'.texi'  : 'application/x-texinfo'  
  ,'.texinfo' : 'application/x-texinfo'  
  ,'.text'  : 'text/plain'  
  ,'.tif'   : 'image/tiff'  
  ,'.tiff'  : 'image/tiff'  
  ,'.torrent' : 'application/x-bittorrent'  
  ,'.tr'    : 'text/troff'  
  ,'.txt'   : 'text/plain'  
  ,'.vcf'   : 'text/x-vcard'  
  ,'.vcs'   : 'text/x-vcalendar'  
  ,'.vrml'  : 'model/vrml'  
  ,'.war'   : 'application/java-archive'  
  ,'.wav'   : 'audio/x-wav'  
  ,'.wma'   : 'audio/x-ms-wma'  
  ,'.wmv'   : 'video/x-ms-wmv'  
  ,'.wmx'   : 'video/x-ms-wmx'  
  ,'.wrl'   : 'model/vrml'  
  ,'.wsdl'  : 'application/wsdl+xml'  
  ,'.xbm'   : 'image/x-xbitmap'  
  ,'.xhtml' : 'application/xhtml+xml'  
  ,'.xls'   : 'application/vnd.ms-excel'  
  ,'.xml'   : 'application/xml'  
  ,'.xpm'   : 'image/x-xpixmap'  
  ,'.xsl'   : 'application/xml'  
  ,'.xslt'  : 'application/xslt+xml'  
  ,'.yaml'  : 'text/yaml'  
  ,'.yml'   : 'text/yaml'  
  ,'.zip'   : 'application/zip'  
};

