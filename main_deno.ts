// Simplified Mock API Application with Config File (Deno Version)

// import {Application, Context} from "https://deno.land/x/oak/mod.ts";
import {resolve} from "https://deno.land/std/path/mod.ts";
import {parse} from "https://deno.land/std/yaml/mod.ts"; // For parsing YAML
import {DB} from "https://deno.land/x/sqlite/mod.ts"; // Deno SQLite library

interface ApiEndpoint {
    method: string;
    path: string;
    response: Record<string, any>;
    statusCode: number;
}

class ApiDefinitionLoader {
    private apiEndpoints: Record<string, ApiEndpoint>;

    constructor(configFile: string) {
        this.apiEndpoints = this.loadApiDefinitions(configFile);
    }

    public getApiEndpoints(): Record<string, ApiEndpoint> {
        return this.apiEndpoints;
    }

    private loadApiDefinitions(
        configFile: string,
    ): Record<string, ApiEndpoint> {
        try {
            const fileContent = Deno.readTextFileSync(resolve(configFile));
            return parse(fileContent) as Record<string, ApiEndpoint>;
        } catch (error) {
            console.error("Failed to load API definitions:", error);
            throw new Error("Failed to load API definitions");
        }
    }
}

class Logger {
    private db: DB;

    constructor(dbName: string) {
        this.db = new DB(dbName);
        this.createTable();
    }

    private createTable() {
        this.db.query(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                request_method TEXT,
                request_path TEXT,
                request_query TEXT,
                request_headers TEXT,
                request_body TEXT,
                response_status_code INTEGER,
                response_body TEXT
            )
        `);
    }

    public log(logData: any) {
        const { timestamp, request, response } = logData;
        const { method, path, query, headers, body } = request;
        const { statusCode, body: responseBody } = response;

        const sql = `
            INSERT INTO api_logs (timestamp, request_method, request_path, request_query, request_headers, request_body, response_status_code, response_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        this.db.query(sql, [
            timestamp,
            method,
            path,
            JSON.stringify(query),
            JSON.stringify(headers),
            JSON.stringify(body),
            statusCode,
            JSON.stringify(responseBody),
        ]);
    }
}

//const app = new Application();
const DEFAULT_PORT = 8000;
const portArg = Deno.args.find((arg) => arg.startsWith("--port="));
const PORT = portArg ? parseInt(portArg.split("=")[1], 10) : DEFAULT_PORT;
const LOG_FILE = "server.log";
const apiDefinitionLoader = new ApiDefinitionLoader("api_definitions.yaml");
const apiEndpoints = apiDefinitionLoader.getApiEndpoints();
const logger = new Logger("api_logs.db");

// Middleware to handle logging
// app.use(async (context: Context) => {
//     const { request, response } = context;
//     const path = request.url.pathname;
//     const method = request.method.toUpperCase();
//     const key = `${method} ${path}`;
//
//     const endpoint = apiEndpoints[key];
//
//     if (!endpoint) {
//         response.status = 404;
//         response.body = "Endpoint not found";
//         return;
//     }
//
//     const logData = {
//         timestamp: new Date().toISOString(),
//         request: {
//             method: request.method,
//             path: request.url.pathname,
//             query: request.url.searchParams,
//             headers: request.headers,
//             body: await request.body.text(),
//         },
//         response: {
//             statusCode: endpoint.statusCode,
//             body: endpoint.response,
//         },
//     };
//
//     logger.log(logData);
//
//     response.status = endpoint.statusCode;
//     response.body = endpoint.response;
// });
//
// app.use(router.routes());
// app.use(router.allowedMethods());

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (request) => {
    // const { request, response } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const key = `${method} ${path}`;

    const endpoint = apiEndpoints[key];

    if (!endpoint) {
        return new Response("Endpoint not found", { status: 404 });
    }

    const logData = {
        timestamp: new Date().toISOString(),
        request: {
            method: request.method,
            path: url.pathname,
            query: url.searchParams,
            headers: request.headers,
            body: await request.text(),
        },
        response: {
            statusCode: endpoint.statusCode,
            body: endpoint.response,
        },
    };

    // response.status = endpoint.statusCode;
    // response.body = endpoint.response;
    return new Response(JSON.stringify(endpoint.response), {
        status: endpoint.statusCode,
        headers: {
            "content-type": "application/json; charset=utf-8",
        },
    });
});

// console.log(`Mock API server running at http://localhost:${PORT}`);
// await .listen({ port: PORT });

// Config File Example (api_definitions.yaml):
// GET /api/data:
//   method: GET
//   path: /api/data
//   response:
//     message: "Mock data fetched successfully!"
//   statusCode: 200
// POST /api/data:
//   method: POST
//   path: /api/data
//   response:
//     message: "Mock data posted successfully!"
//   statusCode: 201
