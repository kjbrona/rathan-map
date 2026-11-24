// Local HTTP preview: no dependencies and no exposure beyond this computer.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const publicDirectories = new Set(["css", "js", "data", "images", "vendor", "candidate-survey"]);
const contentTypes = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};
function createPreviewServer() {
  return http.createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
    let relative;
    try { relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html"; }
    catch (_) { response.writeHead(400); response.end(); return; }
    const file = path.resolve(root, relative);
    if (relative.includes("\\") || relative.split("/").includes("..") ||
      !file.startsWith(root + path.sep) ||
      (relative !== "index.html" && !publicDirectories.has(relative.split("/")[0]))) {
      response.writeHead(404); response.end(); return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      if (request.method === "HEAD") { response.end(); return; }
      fs.createReadStream(file).on("error", () => response.destroy()).pipe(response);
    });
  });
}
module.exports = { createPreviewServer };
if (require.main === module) {
  const port = Number(process.argv[2] || 8080);
  const server = createPreviewServer();
  server.on("error", error => { console.error(`Local preview could not start: ${error.message}`); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => {
    console.log(`RedM Explorer: http://127.0.0.1:${server.address().port}/`);
    console.log("Keep this terminal open. Press Ctrl+C to stop.");
  });
}
