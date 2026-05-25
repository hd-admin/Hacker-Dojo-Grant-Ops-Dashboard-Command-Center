/**
 * Defense-in-depth sanitizer for API-received notification text rendered via dangerouslySetInnerHTML.
 * Two-pass approach: first strip attributes from allowed tags, then remove disallowed tags.
 */
export function sanitizeNotificationText(html: string): string {
  // Pass 1: Strip all attributes from allowed tags (<strong> and <em>)
  let result = html.replace(/<(strong|em)(?:\s[^>]*)?>/gi, '<$1>');
  // Pass 2: Remove all remaining disallowed HTML tags (anything not <strong> or <em>)
  result = result.replace(/<(?!\/?(?:strong|em)\b)[^>]*>/gi, '').trim();
  return result;
}

/**
 * Escapes user-data or Opencode-returned values (grant.title, grant.funder, etc.) before interpolating into HTML notification templates.
 * HTML-entity-encodes to prevent breaking out of template HTML.
 */
export function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
