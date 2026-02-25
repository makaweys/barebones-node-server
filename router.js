const url = require("url");

class Router {
	constructor() {
		this.routes = new Map();
		this.middlewares = [];
		this.paramHandlers = new Map();
	}

	add(method, path, handler) {
		const normalizedPath = this.normalizePath(path);
		const key = `${method.toUpperCase()}:${normalizedPath}`;

		if (this.routes.has(key)) {
			throw new Error(`Route ${method} ${path} already exists`);
		}

		this.routes.set(key, {
			handler,
			params: this.extractParams(normalizedPath),
			regex: this.pathToRegex(normalizedPath),
		});
	}

	get(path, handler) {
		this.add("GET", path, handler);
	}

	post(path, handler) {
		this.add("POST", path, handler);
	}

	put(path, handler) {
		this.add("PUT", path, handler);
	}

	delete(path, handler) {
		this.add("DELETE", path, handler);
	}

	use(path, ...handlers) {
		if (typeof path === "function") {
			this.middlewares.push({ path: "/*", handler: path });
		} else {
			handlers.forEach((handler) => {
				this.middlewares.push({ path, handler });
			});
		}
	}

	param(name, handler) {
		this.paramHandlers.set(name, handler);
	}

	match(method, urlPath) {
		const methodUpper = method.toUpperCase();

		// Check exact match first
		const exactKey = `${methodUpper}:${urlPath}`;
		if (this.routes.has(exactKey)) {
			return {
				handler: this.routes.get(exactKey).handler,
				params: {},
			};
		}

		// Check pattern matches
		for (const [key, route] of this.routes) {
			const [routeMethod, routePath] = key.split(":");

			if (routeMethod !== methodUpper) continue;

			const match = urlPath.match(route.regex);
			if (match) {
				const params = {};
				route.params.forEach((param, index) => {
					params[param] = match[index + 1];
				});

				return {
					handler: route.handler,
					params,
				};
			}
		}

		return null;
	}

	normalizePath(path) {
		// Ensure path starts with /
		if (!path.startsWith("/")) path = "/" + path;
		// Remove trailing slash except for root
		if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
		return path;
	}

	extractParams(path) {
		const params = [];
		const segments = path.split("/");

		segments.forEach((segment) => {
			if (segment.startsWith(":")) {
				params.push(segment.slice(1));
			}
		});

		return params;
	}

	pathToRegex(path) {
		const pattern = path
			.replace(/\/:(\w+)/g, "/([^/]+)") // Convert :param to regex group
			.replace(/\*/g, ".*"); // Convert * to wildcard

		return new RegExp(`^${pattern}$`);
	}

	async handle(req, res) {
		const parsedUrl = url.parse(req.url, true);
		const pathname = parsedUrl.pathname;
		const method = req.method;

		// Apply global middlewares
		for (const mw of this.middlewares) {
			const normalizedPath = this.normalizePath(mw.path);
			const regex = this.pathToRegex(normalizedPath);

			if (regex.test(pathname)) {
				const shouldContinue = await mw.handler(req, res);
				if (shouldContinue === false) return;
			}
		}

		// Find matching route
		const match = this.match(method, pathname);

		if (match) {
			// Handle route parameters
			req.params = match.params;

			// Run param handlers
			for (const [paramName, handler] of this.paramHandlers) {
				if (match.params[paramName]) {
					await handler(req, res, match.params[paramName], paramName);
				}
			}

			// Execute route handler
			await match.handler(req, res);
		} else {
			// 404 Not Found
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: "Not Found",
					message: `Route ${pathname} not found`,
				})
			);
		}
	}
}

module.exports = Router;
