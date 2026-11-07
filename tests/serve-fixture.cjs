const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const mime = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
http
  .createServer((request, response) => {
    const requested = request.url.split("?")[0];
    const file = path.resolve(root, requested === "/" ? "tests/pretext-fixture.html" : "." + requested);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, bytes) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" }).end(bytes);
    });
  })
  .listen(8091, "0.0.0.0");
