/**
 * Semantic DOM query helpers for black-box testing.
 * These functions mirror @testing-library/dom's query API using
 * native DOM methods on a container element, enabling the same
 * accessible-selector patterns without additional dependencies.
 */

interface ByRoleOptions {
  name?: string | RegExp;
  hidden?: boolean;
}

interface ByTextOptions {
  selector?: string;
  exact?: boolean;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function matchesName(element: Element, name: string | RegExp | undefined): boolean {
  if (name === undefined) return true;

  const accessibleName =
    element.getAttribute('aria-label') ??
    element
      .getAttribute('aria-labelledby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ') ??
    element.getAttribute('title') ??
    element.textContent ??
    '';

  const normalized = normalizeWhitespace(accessibleName);

  if (typeof name === 'string') {
    return normalized.includes(name);
  }
  return name.test(normalized);
}

function getElementError(message: string, _container: Element): Error {
  const err = new Error(message);
  (err as Error & { name: string }).name = 'TestingLibraryElementError';
  return err;
}

const IMPLICIT_ROLE_TAGS: Record<string, string[]> = {
  button: ['button'],
  nav: ['navigation'],
  main: ['main'],
  aside: ['complementary'],
  header: ['banner'],
  footer: ['contentinfo'],
  form: ['form'],
  table: ['table'],
  a: ['link'],
  input: ['textbox'],
  textarea: ['textbox'],
  select: ['combobox', 'listbox'],
  img: ['img'],
  h1: ['heading'],
  h2: ['heading'],
  h3: ['heading'],
  h4: ['heading'],
  h5: ['heading'],
  h6: ['heading'],
  ul: ['list'],
  ol: ['list'],
  li: ['listitem'],
  dialog: ['dialog'],
  section: ['region'],
};

function buildRoleSelector(role: string): string {
  const explicit = `[role="${role}"]`;
  const implicitTags = Object.entries(IMPLICIT_ROLE_TAGS)
    .filter(([, roles]) => roles.includes(role))
    .map(([tag]) => tag);
  if (implicitTags.length === 0) return explicit;
  const tagSelectors = implicitTags.map((t) => `${t}:not([role])`).join(', ');
  return `${explicit}, ${tagSelectors}`;
}

export function getByRole(
  container: Element,
  role: string,
  options: ByRoleOptions = {},
): HTMLElement {
  const selector = buildRoleSelector(role);
  const elements = Array.from(container.querySelectorAll(selector)).filter((el) => {
    if (options.hidden === false) {
      const ariaHidden = el.getAttribute('aria-hidden');
      if (ariaHidden === 'true') return false;
    }
    return matchesName(el, options.name);
  });

  if (elements.length === 0) {
    const nameHint = options.name ? ` with name "${options.name}"` : '';
    throw getElementError(
      `Unable to find an accessible element with role "${role}"${nameHint}`,
      container,
    );
  }
  return elements[0] as HTMLElement;
}

export function queryByRole(
  container: Element,
  role: string,
  options: ByRoleOptions = {},
): HTMLElement | null {
  const selector = buildRoleSelector(role);
  const elements = Array.from(container.querySelectorAll(selector)).filter((el) => {
    if (options.hidden === false) {
      const ariaHidden = el.getAttribute('aria-hidden');
      if (ariaHidden === 'true') return false;
    }
    return matchesName(el, options.name);
  });
  return elements.length > 0 ? (elements[0] as HTMLElement) : null;
}

export function getAllByRole(
  container: Element,
  role: string,
  options: ByRoleOptions = {},
): HTMLElement[] {
  const selector = buildRoleSelector(role);
  return Array.from(container.querySelectorAll(selector)).filter((el) => {
    if (options.hidden === false) {
      const ariaHidden = el.getAttribute('aria-hidden');
      if (ariaHidden === 'true') return false;
    }
    return matchesName(el, options.name);
  }) as HTMLElement[];
}

export function getByLabelText(container: Element, labelText: string | RegExp): Element {
  const isMatch = (text: string): boolean =>
    typeof labelText === 'string'
      ? normalizeWhitespace(text).includes(labelText)
      : labelText.test(text);

  const byAriaLabel = Array.from(container.querySelectorAll('[aria-label]')).find((el) =>
    isMatch(el.getAttribute('aria-label') ?? ''),
  );
  if (byAriaLabel) return byAriaLabel;

  const labels = Array.from(container.querySelectorAll('label')).filter((l) =>
    isMatch(l.textContent ?? ''),
  );
  for (const label of labels) {
    const htmlFor = label.getAttribute('for');
    if (htmlFor) {
      const el = container.querySelector(`#${htmlFor}`);
      if (el) return el;
    }
    const nested = label.querySelector('input, select, textarea');
    if (nested) return nested;
  }

  throw getElementError(`Unable to find a label with text matching "${labelText}"`, container);
}

export function getByText(
  container: Element,
  text: string | RegExp,
  options: ByTextOptions = {},
): Element {
  const isMatch = (content: string): boolean => {
    if (typeof text === 'string') {
      if (options.exact) return content === text;
      return content.includes(text);
    }
    return text.test(content);
  };

  const selector = options.selector ?? '*';
  const elements = Array.from(container.querySelectorAll(selector)).filter((el) => {
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent ?? '')
      .join('');
    const fullText = el.textContent ?? '';
    return isMatch(ownText) || isMatch(fullText);
  });

  const directMatch = elements.find((el) => {
    const ownText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent ?? '')
      .join('');
    return isMatch(ownText);
  });

  const result = directMatch ?? elements[0];

  if (!result) {
    throw getElementError(`Unable to find an element with text matching "${text}"`, container);
  }
  return result;
}

export function queryByText(
  container: Element,
  text: string | RegExp,
  options: ByTextOptions = {},
): Element | null {
  try {
    return getByText(container, text, options);
  } catch {
    return null;
  }
}
