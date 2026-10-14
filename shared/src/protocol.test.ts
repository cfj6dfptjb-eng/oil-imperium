import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol.js';

describe('parseClientMessage', () => {
  it('accepts a valid ping', () => {
    expect(parseClientMessage('{"type":"ping","t":5}')).toEqual({ type: 'ping', t: 5 });
  });

  it('rejects bad JSON, unknown types and wrong fields', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('{"type":"nuke"}')).toBeNull();
    expect(parseClientMessage('{"type":"ping","t":"x"}')).toBeNull();
    expect(parseClientMessage('null')).toBeNull();
  });
});
