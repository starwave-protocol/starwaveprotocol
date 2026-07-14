declare module "ws" {
  import { EventEmitter } from "node:events";

  export type RawData = Buffer | ArrayBuffer | Buffer[];

  export class WebSocket extends EventEmitter {
    constructor(address: string);
    send(data: string | Buffer): void;
    close(): void;
    on(event: "open", listener: () => void): this;
    on(event: "message", listener: (data: RawData) => void): this;
    on(event: "close", listener: () => void): this;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options: { port: number });
    close(callback: () => void): void;
    on(event: "connection", listener: (socket: WebSocket) => void): this;
  }
}
