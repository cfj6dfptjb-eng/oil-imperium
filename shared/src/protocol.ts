import { PROTOCOL_VERSION } from './constants.js';

/** Messages the client sends to the server. */
export type ClientMessage =
  | { type: 'ping'; t: number };

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: 'hello'; protocol: number; serverTime: number }
  | { type: 'pong'; t: number }
  | { type: 'error'; message: string };

export function hello(): ServerMessage {
  return { type: 'hello', protocol: PROTOCOL_VERSION, serverTime: Date.now() };
}

/** Parses and validates an incoming client message. Returns null if invalid. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case 'ping':
      return typeof msg.t === 'number' ? { type: 'ping', t: msg.t } : null;
    default:
      return null;
  }
}
