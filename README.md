# Node.js Core Modules HTTP Server

A demonstration of building a fully-functional HTTP server using only Node.js core modules—no external dependencies or frameworks.

## 🎯 Purpose

This project showcases:

-   Deep understanding of Node.js core modules (`http`, `fs`, `path`, `url`, etc.)
-   Building a RESTful API from scratch
-   Proper routing and request handling
-   Middleware pattern implementation without Express
-   File serving and static asset handling
-   Real-world HTTP server features using only native APIs

## ✨ Features

### ✅ Implemented

-   **HTTP Server** with clean routing system
-   **Multiple HTTP methods** (GET, POST, PUT, DELETE)
-   **Query parameter parsing** using `url` module
-   **Request body parsing** for JSON and form data
-   **Static file serving** with proper MIME types
-   **Custom middleware system** (logging, error handling, CORS)
-   **Environment configuration** using `process.env`

### 🚫 No External Dependencies

-   No Express, Koa, or similar frameworks
-   No `body-parser`, `cors`, or routing libraries
-   Only Node.js built-in modules

## 🚀 Quick Start

```bash
# Clone the repository
git clone git@github.com:makaweys/barebones-node-server.git
cd node-core-server

# Run the server
node server.js

# Server runs on http://localhost:3000
```
