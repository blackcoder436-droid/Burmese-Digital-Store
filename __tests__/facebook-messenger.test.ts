import { describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import {
  getMessengerEventText,
  splitMessengerText,
  toMessengerPlainText,
  verifyMetaSignature,
} from '../src/lib/facebook-messenger';

describe('facebook messenger helpers', () => {
  it('verifies Meta sha256 webhook signatures', () => {
    const rawBody = JSON.stringify({ object: 'page', entry: [] });
    const secret = 'test-app-secret';
    const signature = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

    expect(verifyMetaSignature(rawBody, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyMetaSignature(rawBody, `sha256=${signature}`, 'wrong-secret')).toBe(false);
    expect(verifyMetaSignature(rawBody, null, secret)).toBe(false);
  });

  it('extracts text from messages and postbacks', () => {
    expect(getMessengerEventText({ message: { text: ' hello ' } })).toBe('hello');
    expect(getMessengerEventText({ postback: { title: 'Buy VPN' } })).toBe('Buy VPN');
    expect(getMessengerEventText({ postback: { payload: 'START' } })).toBe('START');
    expect(getMessengerEventText({ delivery: {} })).toBeNull();
  });

  it('converts markdown-ish AI replies to Messenger plain text', () => {
    const text = toMessengerPlainText('### Plans\n**VPN**: [Open](https://example.com)\n`code`');

    expect(text).toContain('Plans');
    expect(text).toContain('VPN');
    expect(text).toContain('Open: https://example.com');
    expect(text).toContain('code');
    expect(text).not.toContain('**');
  });

  it('splits long Messenger replies into bounded chunks', () => {
    const text = Array.from({ length: 120 }, (_, index) => `Line ${index} text`).join('\n');
    const parts = splitMessengerText(text, 120, 3);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.length).toBeLessThanOrEqual(3);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(120);
    }
  });
});
