import { describe, expect, it } from 'vitest';
import { escapeForHtml, sanitizeNotificationText } from './sanitize-html';

describe('sanitizeNotificationText', () => {
  it('preserves plain text untouched', () => {
    const input = 'New grant matched: AI Education Fund';
    expect(sanitizeNotificationText(input)).toBe(input);
  });

  it('preserves allowed <strong> tag without attributes', () => {
    const input = 'New match: <strong>AI Education Fund</strong>';
    expect(sanitizeNotificationText(input)).toBe(input);
  });

  it('strips onclick attribute from <strong>', () => {
    const input = '<strong onclick="alert(1)">Click me</strong>';
    expect(sanitizeNotificationText(input)).toBe('<strong>Click me</strong>');
  });

  it('strips style attribute from <strong>', () => {
    const input = '<strong style="color: red">Text</strong>';
    expect(sanitizeNotificationText(input)).toBe('<strong>Text</strong>');
  });

  it('strips <script> tags but leaves text content', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    expect(sanitizeNotificationText(input)).toBe('Hello alert("xss") World');
  });

  it('preserves allowed <em> tag', () => {
    const input = 'Note: <em>urgent</em> deadline approaching';
    expect(sanitizeNotificationText(input)).toBe(input);
  });

  it('removes disallowed tags like <div>', () => {
    const input = 'Message <div class="box">content</div> end';
    expect(sanitizeNotificationText(input)).toBe('Message content end');
  });

  it('handles empty string', () => {
    expect(sanitizeNotificationText('')).toBe('');
  });

  it('strips attributes from <em> tag', () => {
    const input = '<em class="highlight" data-x="1">Important</em>';
    expect(sanitizeNotificationText(input)).toBe('<em>Important</em>');
  });

  it('preserves mixed allowed tags with stripped attributes', () => {
    const input =
      '<strong onclick="x()">Bold</strong> and <em style="color:red">italic</em> text';
    expect(sanitizeNotificationText(input)).toBe('<strong>Bold</strong> and <em>italic</em> text');
  });
});

describe('escapeForHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeForHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes less-than', () => {
    expect(escapeForHtml('x < y')).toBe('x &lt; y');
  });

  it('escapes greater-than', () => {
    expect(escapeForHtml('x > y')).toBe('x &gt; y');
  });

  it('escapes all three special characters', () => {
    expect(escapeForHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    );
  });

  it('returns empty string unchanged', () => {
    expect(escapeForHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(escapeForHtml('Hello World')).toBe('Hello World');
  });

  it('escapes text containing grant data', () => {
    expect(escapeForHtml('Grant: <Untitled> & Co.')).toBe(
      'Grant: &lt;Untitled&gt; &amp; Co.',
    );
  });
});
