/**
 * HTML sanitization utilities for safe rendering of notification text via dangerouslySetInnerHTML.
 * Defense-in-depth: two-pass sanitizer strips attributes and disallowed tags.
 * Escaping: HTML-entity-encodes dynamic values before interpolation into templates.
 */

/**
 * Defense-in-depth sanitizer for API-received notification text rendered via dangerouslySetInnerHTML.
 * Pass 1: Strips attributes from allowed tags (<strong>, <em>) to neutralize onclick, style, etc.
 * Pass 2: Removes all other disallowed HTML tags (anything not <strong> or <em>).
 */
export function sanitizeNotificationText(html: string): string {
  // Pass 1: Strip all attributes from allowed tags (<strong> and <em>)
  let result = html.replace(/<(strong|em)(?:\s[^>]*)?>/gi, '<$1>');
  // Pass 2: Remove all remaining disallowed HTML tags
  result = result.replace(/<(?!\/?(?:strong|em)\b)[^>]*>/gi, '').trim();
  return result;
}

/**
 * Escapes user-data or Opencode-returned values (grant.title, grant.funder, etc.) before
 * interpolating into HTML notification templates.
 */
export function escapeForHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
