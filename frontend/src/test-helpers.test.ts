/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getByRole,
  queryByRole,
  getAllByRole,
  getByLabelText,
  getByText,
  queryByText,
} from './test-helpers';

describe('test-helpers', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  describe('getByRole', () => {
    it('finds element by explicit role', () => {
      container.innerHTML = '<button role="tab">Tab 1</button>';
      const el = getByRole(container, 'tab');
      expect(el.textContent).toBe('Tab 1');
    });

    it('finds element by implicit role', () => {
      container.innerHTML = '<button>Click me</button>';
      const el = getByRole(container, 'button');
      expect(el.textContent).toBe('Click me');
    });

    it('filters by accessible name', () => {
      container.innerHTML = `
        <button aria-label="Save">Save</button>
        <button aria-label="Cancel">Cancel</button>
      `;
      const el = getByRole(container, 'button', { name: 'Save' });
      expect(el.getAttribute('aria-label')).toBe('Save');
    });

    it('throws when no element found', () => {
      expect(() => getByRole(container, 'button')).toThrow(
        'Unable to find an accessible element with role "button"',
      );
    });
  });

  describe('queryByRole', () => {
    it('returns null when no element found', () => {
      const el = queryByRole(container, 'button');
      expect(el).toBeNull();
    });

    it('returns element when found', () => {
      container.innerHTML = '<button>Click</button>';
      const el = queryByRole(container, 'button');
      expect(el).not.toBeNull();
    });
  });

  describe('getAllByRole', () => {
    it('returns all matching elements', () => {
      container.innerHTML = `
        <button>Btn 1</button>
        <button>Btn 2</button>
      `;
      const els = getAllByRole(container, 'button');
      expect(els).toHaveLength(2);
    });

    it('returns empty array when no matches', () => {
      const els = getAllByRole(container, 'button');
      expect(els).toEqual([]);
    });
  });

  describe('getByLabelText', () => {
    it('finds element by aria-label', () => {
      container.innerHTML = '<input aria-label="Search" />';
      const el = getByLabelText(container, 'Search');
      expect(el.tagName).toBe('INPUT');
    });

    it('finds element by label for attribute', () => {
      container.innerHTML = `
        <label for="name-input">Name</label>
        <input id="name-input" />
      `;
      const el = getByLabelText(container, 'Name');
      expect(el.id).toBe('name-input');
    });

    it('finds nested input in label', () => {
      container.innerHTML = `
        <label>
          Email
          <input type="email" />
        </label>
      `;
      const el = getByLabelText(container, 'Email');
      expect(el.getAttribute('type')).toBe('email');
    });

    it('throws when no label found', () => {
      expect(() => getByLabelText(container, 'Missing')).toThrow(
        'Unable to find a label with text matching "Missing"',
      );
    });
  });

  describe('getByText', () => {
    it('finds element by text content', () => {
      container.innerHTML = '<p>Hello world</p>';
      const el = getByText(container, 'Hello world');
      expect(el.tagName).toBe('P');
    });

    it('supports exact matching', () => {
      container.innerHTML = '<p>Hello</p>';
      expect(() => getByText(container, 'Hello', { exact: true })).not.toThrow();
      expect(() => getByText(container, 'Hell', { exact: true })).toThrow();
    });

    it('supports regex matching', () => {
      container.innerHTML = '<p>Version 1.2.3</p>';
      const el = getByText(container, /Version \d+\.\d+\.\d+/);
      expect(el).toBeDefined();
    });

    it('throws when text not found', () => {
      expect(() => getByText(container, 'Missing')).toThrow(
        'Unable to find an element with text matching "Missing"',
      );
    });
  });

  describe('queryByText', () => {
    it('returns null when text not found', () => {
      const el = queryByText(container, 'Missing');
      expect(el).toBeNull();
    });

    it('returns element when found', () => {
      container.innerHTML = '<p>Found</p>';
      const el = queryByText(container, 'Found');
      expect(el).not.toBeNull();
    });
  });
});
