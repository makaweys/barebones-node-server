const http = require("http");
const url = require("url");
const router = require("./router.js");
const middleware = require("./middleware.js");
const staticServer = require("./static-server.js");
const { parseRequest } = require("./utils/request-parser.js");
const { createResponse } = require("./utils/response-helper.js");

class HTTPServer {
	constructor(port = 3000) {
		this.port = port;
		this.server = null;
		this.middlewares = [];
		this.routes = new Map();

		// Initialize default middleware
		this.use(middleware.logger);
		this.use(middleware.cors());
	}

	use(middleware) {
		this.middlewares.push(middleware);
		return this;
	}

	get(path, handler) {
		this.addRoute("GET", path, handler);
		return this;
	}

	post(path, handler) {
		this.addRoute("POST", path, handler);
		return this;
	}

	put(path, handler) {
		this.addRoute("PUT", path, handler);
		return this;
	}

	delete(path, handler) {
		this.addRoute("DELETE", path, handler);
		return this;
	}

	addRoute(method, path, handler) {
		const key = `${method}:${path}`;
		this.routes.set(key, handler);
	}

	async handleRequest(req, res) {
		// Parse request
		const parsedReq = await parseRequest(req);

		// Run middlewares
		for (const mw of this.middlewares) {
			const result = await mw(parsedReq, res);
			if (result === false) return;
		}

		// Find matching route
		const pathname = url.parse(req.url, true).pathname;
		const method = req.method;
		const routeKey = `${method}:${pathname}`;

		// Check static files first
		if (method === "GET" && pathname.startsWith("/public/")) {
			return staticServer.serveFile(req, res);
		}

		// Check API routes
		const handler =
			this.routes.get(routeKey) ||
			this.routes.get(`${method}:/*`) ||
			this.notFoundHandler;

		try {
			await handler(parsedReq, res);
		} catch (error) {
			this.errorHandler(error, req, res);
		}
	}

	notFoundHandler(req, res) {
		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				error: "Not Found",
				message: `Route ${req.url} not found`,
			})
		);
	}

	errorHandler(error, req, res) {
		console.error("Server Error:", error);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				error: "Internal Server Error",
				message: error.message,
			})
		);
	}

	start() {
		this.server = http.createServer((req, res) => {
			this.handleRequest(req, res);
		});

		this.server.listen(this.port, () => {
			console.log(`Server running at http://localhost:${this.port}`);
			console.log(
				`Environment: ${process.env.NODE_ENV || "development"}`
			);
		});

		// Graceful shutdown
		process.on("SIGTERM", () => this.shutdown());
		process.on("SIGINT", () => this.shutdown());

		return this;
	}

	shutdown() {
		console.log("Shutting down server...");
		this.server.close(() => {
			console.log("Server stopped");
			process.exit(0);
		});
	}
}

// Example routes
const app = new HTTPServer();

// API Routes
app.get("/api/health", (req, res) => {
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			status: "healthy",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		})
	);
});

app.get("/api/users", (req, res) => {
	const users = [
		{ id: 1, name: "John Doe", email: "john@example.com" },
		{ id: 2, name: "Jane Smith", email: "jane@example.com" },
	];

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(users));
});

app.post("/api/users", async (req, res) => {
	const user = req.body;
	user.id = Date.now();

	res.writeHead(201, { "Content-Type": "application/json" });
	res.end(JSON.stringify(user));
});

// Serve static files from public directory
app.get("/", (req, res) => {
	res.writeHead(200, { "Content-Type": "text/html" });
	res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Node Core Server</title>
        <link rel="stylesheet" href="/public/style.css">
      </head>
      <body>
        <h1>Node.js Core Modules Server</h1>
        <p>Built with zero dependencies!</p>
        <a href="/api/health">Health Check</a> | 
        <a href="/api/users">Users API</a> |
        <a href="/examples/middleware">Middleware Example</a>
      </body>
    </html>
  `);
});

// Start server
if (require.main === module) {
	app.start();
}

module.exports = HTTPServer;
