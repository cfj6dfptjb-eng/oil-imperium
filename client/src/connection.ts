import type { ClientMessage, ServerMessage } from '@oil/shared';

export type ConnectionState = 'connecting' | 'online' | 'offline';

/** WebSocket wrapper that reconnects, measures latency and passes messages on. */
export class Connection {
  state: ConnectionState = 'connecting';
  latencyMs: number | null = null;
  /** Called for every message from the server, including each new 'hello' after a reconnect. */
  onMessage: (msg: ServerMessage) => void = () => {};
  private socket?: WebSocket;
  private pingTimer?: number;

  constructor(private readonly url: string) {
    this.open();
  }

  private open(): void {
    this.state = 'connecting';
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onmessage = (ev) => this.handle(JSON.parse(ev.data) as ServerMessage);
    socket.onclose = () => {
      this.state = 'offline';
      window.clearInterval(this.pingTimer);
      window.setTimeout(() => this.open(), 2000);
    };
  }

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case 'hello':
        this.state = 'online';
        this.ping();
        window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => this.ping(), 5000);
        break;
      case 'pong':
        this.latencyMs = Math.round(performance.now() - msg.t);
        return;
    }
    this.onMessage(msg);
  }

  private ping(): void {
    this.send({ type: 'ping', t: performance.now() });
  }

  send(msg: ClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(msg));
    return true;
  }
}
