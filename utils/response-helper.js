class ResponseHelper {
	static json(res, data, statusCode = 200, headers = {}) {
		const defaultHeaders = {
			"Content-Type": "application/json",
			"Cache-Control": "no-cache",
		};

		const responseHeaders = { ...defaultHeaders, ...headers };

		res.writeHead(statusCode, responseHeaders);
		res.end(JSON.stringify(data));
	}

	static html(res, html, statusCode = 200, headers = {}) {
		const defaultHeaders = {
			"Content-Type": "text/html; charset=utf-8",
		};

		const responseHeaders = { ...defaultHeaders, ...headers };

		res.writeHead(statusCode, responseHeaders);
		res.end(html);
	}

	static text(res, text, statusCode = 200, headers = {}) {
		const defaultHeaders = {
			"Content-Type": "text/plain; charset=utf-8",
		};

		const responseHeaders = { ...defaultHeaders, ...headers };

		res.writeHead(statusCode, responseHeaders);
		res.end(text);
	}

	static redirect(res, location, statusCode = 302) {
		res.writeHead(statusCode, { Location: location });
		res.end();
	}

	static error(res, message, statusCode = 500, details = {}) {
		const errorResponse = {
			error: message,
			statusCode,
			timestamp: new Date().toISOString(),
			...details,
		};

		this.json(res, errorResponse, statusCode);
	}

	static notFound(res, message = "Resource not found") {
		this.error(res, message, 404);
	}

	static unauthorized(res, message = "Unauthorized") {
		this.error(res, message, 401);
	}

	static forbidden(res, message = "Forbidden") {
		this.error(res, message, 403);
	}

	static badRequest(res, message = "Bad Request", errors = []) {
		this.error(res, message, 400, { errors });
	}

	static setCookie(res, name, value, options = {}) {
		const defaults = {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Strict",
			maxAge: 24 * 60 * 60 * 1000, // 1 day
			path: "/",
		};

		const cookieOptions = { ...defaults, ...options };

		let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

		if (cookieOptions.maxAge) {
			cookie += `; Max-Age=${Math.floor(cookieOptions.maxAge / 1000)}`;
		}

		if (cookieOptions.expires) {
			cookie += `; Expires=${cookieOptions.expires.toUTCString()}`;
		}

		if (cookieOptions.path) {
			cookie += `; Path=${cookieOptions.path}`;
		}

		if (cookieOptions.domain) {
			cookie += `; Domain=${cookieOptions.domain}`;
		}

		if (cookieOptions.secure) {
			cookie += "; Secure";
		}

		if (cookieOptions.httpOnly) {
			cookie += "; HttpOnly";
		}

		if (cookieOptions.sameSite) {
			cookie += `; SameSite=${cookieOptions.sameSite}`;
		}

		res.setHeader("Set-Cookie", cookie);
	}

	static clearCookie(res, name, options = {}) {
		this.setCookie(res, name, "", { ...options, maxAge: 0 });
	}

	static setHeaders(res, headers) {
		Object.entries(headers).forEach(([key, value]) => {
			res.setHeader(key, value);
		});
	}

	static sendFile(res, filePath, mimeType, callback) {
		const fs = require("fs");
		const path = require("path");

		fs.readFile(filePath, (err, data) => {
			if (err) {
				if (callback) callback(err);
				else this.error(res, "File not found", 404);
				return;
			}

			res.writeHead(200, { "Content-Type": mimeType });
			res.end(data);

			if (callback) callback(null, data);
		});
	}

	static stream(res, readableStream, mimeType = "application/octet-stream") {
		res.writeHead(200, { "Content-Type": mimeType });
		readableStream.pipe(res);

		readableStream.on("error", (err) => {
			console.error("Stream error:", err);
			if (!res.headersSent) {
				this.error(res, "Stream error", 500);
			}
		});
	}
}

module.exports = ResponseHelper;
