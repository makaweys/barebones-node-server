const url = require("url");
const querystring = require("querystring");

async function parseRequest(req) {
	const parsedUrl = url.parse(req.url, true);

	// Enhanced request object
	req.parsedUrl = parsedUrl;
	req.query = parsedUrl.query;
	req.pathname = parsedUrl.pathname;

	// Parse body based on content type
	if (req.method === "POST" || req.method === "PUT") {
		await parseRequestBody(req);
	}

	return req;
}

function parseRequestBody(req) {
	return new Promise((resolve, reject) => {
		const contentType = req.headers["content-type"] || "";
		let body = "";

		req.on("data", (chunk) => {
			body += chunk.toString();
		});

		req.on("end", () => {
			try {
				if (contentType.includes("application/json")) {
					req.body = body ? JSON.parse(body) : {};
				} else if (
					contentType.includes("application/x-www-form-urlencoded")
				) {
					req.body = querystring.parse(body);
				} else if (contentType.includes("multipart/form-data")) {
					// Handle multipart/form-data (simplified)
					req.body = parseMultipartFormData(body, contentType);
				} else {
					// Default: try JSON, then form data
					try {
						req.body = JSON.parse(body);
					} catch {
						req.body = querystring.parse(body);
					}
				}
				resolve();
			} catch (error) {
				reject(
					new Error(`Failed to parse request body: ${error.message}`)
				);
			}
		});

		req.on("error", reject);
	});
}

function parseMultipartFormData(body, contentType) {
	// Simple multipart parser (for demonstration)
	// In production, you'd want a more robust parser
	const boundary = contentType.split("boundary=")[1];
	const parts = body.split(`--${boundary}`);

	const result = {};

	parts.forEach((part) => {
		if (part.includes("Content-Disposition")) {
			const match = part.match(/name="([^"]+)"/);
			if (match) {
				const name = match[1];
				const value = part.split("\r\n\r\n")[1];
				if (value) {
					result[name] = value.trim();
				}
			}
		}
	});

	return result;
}

function parseCookies(cookieHeader) {
	if (!cookieHeader) return {};

	return cookieHeader.split(";").reduce((cookies, cookie) => {
		const [name, ...valueParts] = cookie.trim().split("=");
		const value = valueParts.join("="); // In case value contains '='
		cookies[name] = decodeURIComponent(value);
		return cookies;
	}, {});
}

function getClientIP(req) {
	return (
		req.headers["x-forwarded-for"]?.split(",")[0] ||
		req.headers["x-real-ip"] ||
		req.socket.remoteAddress
	);
}

module.exports = {
	parseRequest,
	parseRequestBody,
	parseCookies,
	getClientIP,
};
