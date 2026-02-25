const fs = require("fs");
const path = require("path");
const url = require("url");

class StaticServer {
	constructor(rootDir = "public") {
		this.rootDir = path.resolve(process.cwd(), rootDir);
		this.mimeTypes = {
			".html": "text/html",
			".htm": "text/html",
			".css": "text/css",
			".js": "text/javascript",
			".json": "application/json",
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".svg": "image/svg+xml",
			".ico": "image/x-icon",
			".txt": "text/plain",
			".pdf": "application/pdf",
			".zip": "application/zip",
			".mp3": "audio/mpeg",
			".mp4": "video/mp4",
			".woff": "font/woff",
			".woff2": "font/woff2",
			".ttf": "font/ttf",
		};
	}

	getMimeType(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		return this.mimeTypes[ext] || "application/octet-stream";
	}

	serveFile(req, res) {
		const parsedUrl = url.parse(req.url);
		let filePath = path.join(this.rootDir, parsedUrl.pathname);

		// Security: Prevent directory traversal
		if (!filePath.startsWith(this.rootDir)) {
			this.sendError(res, 403, "Forbidden");
			return;
		}

		// Check if file exists
		fs.stat(filePath, (err, stats) => {
			if (err || !stats.isFile()) {
				// Try with index.html if directory
				if (stats && stats.isDirectory()) {
					filePath = path.join(filePath, "index.html");
					this.serveFile(req, res); // Recursive call
					return;
				}
				this.sendError(res, 404, "File not found");
				return;
			}

			// Check for conditional GET (If-Modified-Since)
			const ifModifiedSince = req.headers["if-modified-since"];
			if (ifModifiedSince) {
				const lastModified = new Date(stats.mtime);
				const ifModifiedSinceDate = new Date(ifModifiedSince);

				if (lastModified <= ifModifiedSinceDate) {
					res.writeHead(304);
					res.end();
					return;
				}
			}

			// Set headers
			const headers = {
				"Content-Type": this.getMimeType(filePath),
				"Content-Length": stats.size,
				"Last-Modified": stats.mtime.toUTCString(),
				"Cache-Control": "public, max-age=3600", // 1 hour cache
			};

			// Handle range requests (for audio/video)
			const range = req.headers.range;
			if (range) {
				this.handleRangeRequest(filePath, range, stats, res, headers);
				return;
			}

			// Stream the file
			this.streamFile(filePath, res, 200, headers);
		});
	}

	streamFile(filePath, res, statusCode = 200, headers = {}) {
		const stream = fs.createReadStream(filePath);

		res.writeHead(statusCode, headers);
		stream.pipe(res);

		stream.on("error", (err) => {
			console.error("Stream error:", err);
			if (!res.headersSent) {
				this.sendError(res, 500, "Internal Server Error");
			}
		});

		res.on("close", () => {
			stream.destroy();
		});
	}

	handleRangeRequest(filePath, range, stats, res, headers) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

		if (start >= stats.size || end >= stats.size) {
			headers["Content-Range"] = `bytes */${stats.size}`;
			res.writeHead(416, headers);
			res.end();
			return;
		}

		headers["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
		headers["Content-Length"] = end - start + 1;
		headers["Accept-Ranges"] = "bytes";

		const stream = fs.createReadStream(filePath, { start, end });
		res.writeHead(206, headers);
		stream.pipe(res);
	}

	sendError(res, statusCode, message) {
		res.writeHead(statusCode, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: message }));
	}

	// Directory listing (optional, for development)
	listDirectory(dirPath, res) {
		fs.readdir(dirPath, (err, files) => {
			if (err) {
				this.sendError(res, 500, "Unable to list directory");
				return;
			}

			const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Directory: ${path.basename(dirPath)}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              h1 { color: #333; }
              ul { list-style: none; padding: 0; }
              li { padding: 5px 0; }
              a { color: #0066cc; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <h1>Directory: ${path.basename(dirPath)}</h1>
            <ul>
              ${files
					.map((file) => {
						const isDir = fs
							.statSync(path.join(dirPath, file))
							.isDirectory();
						const icon = isDir ? "📁" : "📄";
						const href =
							encodeURIComponent(file) + (isDir ? "/" : "");
						return `<li>${icon} <a href="${href}">${file}</a></li>`;
					})
					.join("")}
            </ul>
          </body>
        </html>
      `;

			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(html);
		});
	}
}

// Create and export singleton instance
const staticServer = new StaticServer();
module.exports = staticServer;
