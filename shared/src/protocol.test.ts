import { describe, expect, it } from 'vitest';
import { cleanName, parseAction, parseClientMessage } from './protocol.js';

describe('parseClientMessage', () => {
  it('accepts a valid ping', () => {
    expect(parseClientMessage('{"type":"ping","t":5}')).toEqual({ type: 'ping', t: 5 });
  });

  it('rejects bad JSON, unknown types and wrong fields', () => {
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('{"type":"nuke"}')).toBeNull();
    expect(parseClientMessage('{"type":"ping","t":"x"}')).toBeNull();
    expect(parseClientMessage('null')).toBeNull();
    expect(parseClientMessage('[]')).toBeNull();
  });

  it('parses lobby messages', () => {
    expect(parseClientMessage('{"type":"joinRoom","code":"ABCD","name":"x"}')).toEqual({ type: 'joinRoom', code: 'ABCD', name: 'x' });
    expect(parseClientMessage('{"type":"takeSeat","company":"Transoil"}')).toEqual({ type: 'takeSeat', company: 'Transoil' });
    expect(parseClientMessage('{"type":"takeSeat","company":"Shell"}')).toBeNull();
    expect(parseClientMessage('{"type":"setGoal","goal":"money"}')).toEqual({ type: 'setGoal', goal: 'money' });
    expect(parseClientMessage('{"type":"setGoal","goal":"fun"}')).toBeNull();
  });

  it('wraps actions with a request id', () => {
    expect(parseClientMessage('{"type":"action","id":3,"action":{"type":"endTurn"}}')).toEqual({
      type: 'action',
      id: 3,
      action: { type: 'endTurn' },
    });
  });
});

describe('parseAction', () => {
  it('accepts well-formed actions', () => {
    expect(parseAction({ type: 'buyLicence', region: 'Europe' })).toEqual({ type: 'buyLicence', region: 'Europe' });
    expect(parseAction({ type: 'sellOil', region: 'USSR', barrels: 100 })).toEqual({ type: 'sellOil', region: 'USSR', barrels: 100 });
    expect(parseAction({ type: 'survey', fieldId: 'Europe:1,2' })).toEqual({ type: 'survey', fieldId: 'Europe:1,2' });
    expect(parseAction({ type: 'buildPipeline', region: 'Alaska' })).toEqual({ type: 'buildPipeline', region: 'Alaska' });
    expect(parseAction({ type: 'buyTanker', region: 'Alaska', extra: 1 })).toEqual({ type: 'buyTanker', region: 'Alaska' });
    expect(parseAction({ type: 'acceptContract', contractId: 'C4' })).toEqual({ type: 'acceptContract', contractId: 'C4' });
    expect(parseAction({ type: 'sabotage', target: 'Transoil', kind: 'fire' })).toEqual({ type: 'sabotage', target: 'Transoil', kind: 'fire' });
    expect(parseAction({ type: 'setSecurity', on: true })).toEqual({ type: 'setSecurity', on: true });
    expect(parseAction({ type: 'extinguishFire', fieldId: 'USSR:0,0' })).toEqual({ type: 'extinguishFire', fieldId: 'USSR:0,0' });
  });

  it('rejects anything that could confuse the rules engine', () => {
    expect(parseAction({ type: 'buyLicence', region: 'Mars' })).toBeNull();
    expect(parseAction({ type: 'buyLicence' })).toBeNull();
    expect(parseAction({ type: 'sellOil', region: 'USSR', barrels: -5 })).toBeNull();
    expect(parseAction({ type: 'takeLoan', amount: Infinity })).toBeNull();
    expect(parseAction({ type: 'takeLoan', amount: '100' })).toBeNull();
    expect(parseAction({ type: 'survey', fieldId: 42 })).toBeNull();
    expect(parseAction({ type: 'sabotage', target: 'Shell', kind: 'fire' })).toBeNull();
    expect(parseAction({ type: 'sabotage', target: 'Transoil', kind: 'bomb' })).toBeNull();
    expect(parseAction({ type: 'setSecurity', on: 'yes' })).toBeNull();
    expect(parseAction({ type: 'acceptContract', contractId: 7 })).toBeNull();
  });
});

describe('cleanName', () => {
  it('keeps names short and plain', () => {
    expect(cleanName('Jouni <script>')).toBe('JOUNI SCRIPT');
    expect(cleanName('   ')).toBe('PLAYER');
    expect(cleanName('abcdefghijklmnopq')).toHaveLength(12);
  });
});
