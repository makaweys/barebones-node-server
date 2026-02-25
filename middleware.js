const url = require("url");

// Logger middleware
function logger(req, res) {
	const startTime = Date.now();
	const { method, url: reqUrl } = req;

	// Listen for response finish to log completion
	res.on("finish", () => {
		const duration = Date.now() - startTime;
		console.log(
			`[${new Date().toISOString()}] ${method} ${reqUrl} - ${
				res.statusCode
			} - ${duration}ms`
		);
	});

	return true;
}

// CORS middleware factory
function cors(options = {}) {
	const defaults = {
		origin: "*",
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		headers: ["Content-Type", "Authorization"],
		credentials: false,
		maxAge: 86400, // 24 hours
	};

	const config = { ...defaults, ...options };

	return function (req, res) {
		// Handle preflight requests
		if (req.method === "OPTIONS") {
			res.writeHead(204, {
				"Access-Control-Allow-Origin": config.origin,
				"Access-Control-Allow-Methods": config.methods.join(", "),
				"Access-Control-Allow-Headers": config.headers.join(", "),
				"Access-Control-Max-Age": config.maxAge,
				...(config.credentials && {
					"Access-Control-Allow-Credentials": "true",
				}),
			});
			res.end();
			return false; // Stop further processing
		}

		// Add CORS headers to all responses
		res.setHeader("Access-Control-Allow-Origin", config.origin);
		if (config.credentials) {
			res.setHeader("Access-Control-Allow-Credentials", "true");
		}

		return true;
	};
}

// Authentication middleware
function authenticate() {
	return function (req, res) {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			res.writeHead(401, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Unauthorized" }));
			return false;
		}

		const token = authHeader.split(" ")[1];
		// In a real app, validate the token here
		req.user = { id: 1, token }; // Mock user

		return true;
	};
}

// Rate limiting middleware
function rateLimit(maxRequests = 100, windowMs = 60000) {
	const requests = new Map();

	setInterval(() => {
		const now = Date.now();
		for (const [ip, timestamps] of requests) {
			const validTimestamps = timestamps.filter(
				(time) => now - time < windowMs
			);
			if (validTimestamps.length === 0) {
				requests.delete(ip);
			} else {
				requests.set(ip, validTimestamps);
			}
		}
	}, windowMs);

	return function (req, res) {
		const ip = req.socket.remoteAddress;
		const now = Date.now();

		if (!requests.has(ip)) {
			requests.set(ip, []);
		}

		const timestamps = requests.get(ip);
		const recentRequests = timestamps.filter(
			(time) => now - time < windowMs
		);

		if (recentRequests.length >= maxRequests) {
			res.writeHead(429, {
				"Content-Type": "application/json",
				"Retry-After": Math.ceil(windowMs / 1000),
			});
			res.end(
				JSON.stringify({
					error: "Too Many Requests",
					message: `Rate limit exceeded. Try again in ${Math.ceil(
						windowMs / 1000
					)} seconds.`,
				})
			);
			return false;
		}

		timestamps.push(now);
		requests.set(ip, timestamps);

		// Add rate limit headers
		res.setHeader("X-RateLimit-Limit", maxRequests);
		res.setHeader(
			"X-RateLimit-Remaining",
			maxRequests - recentRequests.length - 1
		);
		res.setHeader(
			"X-RateLimit-Reset",
			new Date(now + windowMs).toISOString()
		);

		return true;
	};
}

// Request validation middleware
function validate(schema) {
	return async function (req, res) {
		if (!req.body) {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Request body required" }));
			return false;
		}

		const errors = [];

		for (const [field, rules] of Object.entries(schema)) {
			const value = req.body[field];

			if (
				rules.required &&
				(value === undefined || value === null || value === "")
			) {
				errors.push(`${field} is required`);
				continue;
			}

			if (value !== undefined && value !== null) {
				if (rules.type && typeof value !== rules.type) {
					errors.push(`${field} must be ${rules.type}`);
				}

				if (rules.minLength && value.length < rules.minLength) {
					errors.push(
						`${field} must be at least ${rules.minLength} characters`
					);
				}

				if (rules.maxLength && value.length > rules.maxLength) {
					errors.push(
						`${field} must be at most ${rules.maxLength} characters`
					);
				}

				if (rules.pattern && !rules.pattern.test(value)) {
					errors.push(`${field} is invalid`);
				}
			}
		}

		if (errors.length > 0) {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ errors }));
			return false;
		}

		return true;
	};
}

// Compression middleware (gzip)
const zlib = require("zlib");

function compress(minSize = 1024) {
	return function (req, res, next) {
		const acceptEncoding = req.headers["accept-encoding"] || "";
		const originalWrite = res.write;
		const originalEnd = res.end;
		const chunks = [];

		// Only compress if client accepts gzip
		if (!acceptEncoding.includes("gzip")) return true;

		// Only compress responses above minSize
		res.write = function (chunk, encoding) {
			chunks.push(Buffer.from(chunk, encoding));
			return true;
		};

		res.end = function (chunk, encoding) {
			if (chunk) {
				chunks.push(Buffer.from(chunk, encoding));
			}

			const body = Buffer.concat(chunks);

			if (body.length < minSize) {
				// Too small, send uncompressed
				res.setHeader("Content-Length", body.length);
				originalWrite.call(res, body);
				originalEnd.call(res);
				return res;
			}

			zlib.gzip(body, (err, compressed) => {
				if (err) {
					// Fallback to uncompressed
					res.setHeader("Content-Length", body.length);
					originalWrite.call(res, body);
					originalEnd.call(res);
					return;
				}

				res.setHeader("Content-Encoding", "gzip");
				res.setHeader("Content-Length", compressed.length);
				originalWrite.call(res, compressed);
				originalEnd.call(res);
			});
		};

		return true;
	};
}

module.exports = {
	logger,
	cors,
	authenticate,
	rateLimit,
	validate,
	compress,
};
