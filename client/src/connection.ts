import type { ClientMessage, ServerMessage } from '@oil/shared';

export type ConnectionState = 'connecting' | 'online' | 'offline';

/** WebSocket wrapper that reconnects and measures round-trip latency. */
export class Connection {
  state: ConnectionState = 'connecting';
  latencyMs: number | null = null;
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
        this.pingTimer = window.setInterval(() => this.ping(), 5000);
        break;
      case 'pong':
        this.latencyMs = Math.round(performance.now() - msg.t);
        break;
      case 'error':
        console.warn('Server error:', msg.message);
        break;
    }
  }

  private ping(): void {
    this.send({ type: 'ping', t: performance.now() });
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }
}
