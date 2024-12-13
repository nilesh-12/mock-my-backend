// Simplified Mock API Application with Config File

import express, {Request, Response} from 'express';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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

    private loadApiDefinitions(configFile: string): Record<string, ApiEndpoint> {
        try {
            const fileContent = fs.readFileSync(path.resolve(configFile), 'utf8');
            return yaml.load(fileContent) as Record<string, ApiEndpoint>;
        } catch (error) {
            console.error('Failed to load API definitions:', error);
            throw new Error('Failed to load API definitions');
        }
    }
}

class Logger {
    private db: sqlite3.Database;

    constructor(dbName: string) {
        this.db = new sqlite3.Database(dbName, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to the database.');
            }
        });

        this.createTable();
    }

    private createTable() {
        this.db.run(`
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
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Table created successfully.');
            }
        });
    }

    public log(logData: any) {
        const { timestamp, request, response } = logData;
        const { method, path, query, headers, body } = request;
        const { statusCode, body: responseBody } = response;

        const sql = `
            INSERT INTO api_logs (timestamp, request_method, request_path, request_query, request_headers, request_body, response_status_code, response_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        this.db.run(sql, [timestamp, method, path, JSON.stringify(query), JSON.stringify(headers), JSON.stringify(body), statusCode, JSON.stringify(responseBody)], (err) => {
            if (err) {
                console.error('Error inserting log:', err.message);
            }
        });
    }
}

const app = express();
const PORT = 3000;
const LOG_FILE = 'server.log';
const apiDefinitionLoader = new ApiDefinitionLoader('api_definitions.yaml');
const apiEndpoints = apiDefinitionLoader.getApiEndpoints();
const logger = new Logger('api_logs.db');

app.use(express.json());

app.all('*', (req: Request, res: Response) => {
    const path = req.path;
    const method = req.method.toUpperCase();
    const key = `${method} ${path}`;

    const endpoint = apiEndpoints[key];

    if (!endpoint) {
        return res.status(404).send('Endpoint not found');
    }

    const logData = {
        timestamp: new Date().toISOString(),
        request: {
            method: req.method,
            path: req.path,
            query: req.query,
            headers: req.headers,
            body: req.body,
        },
        response: {
            statusCode: endpoint.statusCode,
            body: endpoint.response,
        },
    };

    logger.log(logData)

    return res.status(endpoint.statusCode).json(endpoint.response);
});

app.listen(PORT, () => {
    console.log(`Mock API server running at http://localhost:${PORT}`);
});

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

// This approach simplifies maintenance by storing API definitions in a config file like YAML.
// Updates to APIs only require changes to the config file, reducing the need for frequent backend updates.
