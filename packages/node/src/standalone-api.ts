import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { StarwaveNode } from "./starwave-node.js";
import { LoggerLike } from "./types.js";
import { StandaloneApiConfig } from "./config.js";

interface JsonRequest<T = unknown> {
  body: T;
}

export class StandaloneApiServer {
  private server?: Server;

  constructor(
    private readonly node: StarwaveNode,
    private readonly config: StandaloneApiConfig,
    private readonly logger: LoggerLike,
  ) {}

  async start(): Promise<void> {
    const host = this.config.host ?? "127.0.0.1";
    const port = this.config.port ?? 3090;

    this.server = createServer(async (req, res) => {
      try {
        await this.route(req, res);
      } catch (error) {
        this.logger.error("Standalone API error", { error: String(error) });
        this.json(res, 500, { error: "Internal server error" });
      }
    });

    await new Promise<void>((resolve) => {
      this.server?.listen(port, host, () => resolve());
    });

    this.logger.info("Standalone API listening", { host, port });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (method === "GET" && pathname === "/") {
      this.json(res, 200, {
        service: "StarWave 2 standalone API",
        address: this.node.address,
        endpoints: [
          "GET /health",
          "GET /node",
          "GET /routes",
          "GET /routes/:destination",
          "POST /messages/:destination",
          "POST /packets",
        ],
      });
      return;
    }

    if (method === "GET" && pathname === "/health") {
      this.json(res, 200, { ok: true, address: this.node.address });
      return;
    }

    if (method === "GET" && pathname === "/node") {
      this.json(res, 200, {
        address: this.node.address,
        transports: this.node.getTransportSnapshot(),
        peers: this.node.getPeerSessionsSnapshot(),
        knownPeers: this.node.getPeerSnapshot(),
      });
      return;
    }

    if (method === "GET" && pathname === "/routes") {
      this.json(res, 200, {
        routes: this.node.routeStore.snapshot(),
      });
      return;
    }

    if (method === "GET" && pathname.startsWith("/routes/")) {
      const destination = decodeURIComponent(pathname.slice("/routes/".length)).toLowerCase();
      this.json(res, 200, {
        route: this.node.routeStore.get(destination) ?? null,
      });
      return;
    }

    if (method === "POST" && pathname.startsWith("/messages/")) {
      const destination = decodeURIComponent(pathname.slice("/messages/".length)).toLowerCase();
      const request = await this.readJson<{ payload: unknown }>(req);
      const packet = await this.node.send(destination, request.body.payload);
      this.json(res, 200, { packet });
      return;
    }

    if (method === "POST" && pathname === "/packets") {
      const request = await this.readJson<{
        destination: string;
        payload: unknown;
        ttlMs?: number;
        hopLimit?: number;
        expectedRoute?: string[];
        publish?: boolean;
      }>(req);

      const packet = await this.node.createSignedPacket({
        source: this.node.address,
        destination: request.body.destination,
        payload: request.body.payload,
        ttlMs: request.body.ttlMs,
        hopLimit: request.body.hopLimit,
        expectedRoute: request.body.expectedRoute,
      });

      if (request.body.publish) {
        await this.node.publishPacket(packet);
      }

      this.json(res, 200, { packet, published: Boolean(request.body.publish) });
      return;
    }

    this.json(res, 404, { error: "Not found" });
  }

  private async readJson<T>(req: IncomingMessage): Promise<JsonRequest<T>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (!text) {
      return { body: {} as T };
    }

    return { body: JSON.parse(text) as T };
  }

  private json(res: ServerResponse, status: number, payload: unknown): void {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  }
}
