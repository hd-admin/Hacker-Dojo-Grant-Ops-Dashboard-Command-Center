import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { withZodValidation } from './api-helpers';

const TestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('withZodValidation', () => {
  it('returns success with parsed data when valid', () => {
    const result = withZodValidation(TestSchema, { name: 'Alice', age: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('returns failure with 400 response when invalid', () => {
    const result = withZodValidation(TestSchema, { name: '', age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const json = result.response;
      expect(json.status).toBe(400);
    }
  });

  it('returns failure with validation error code', async () => {
    const result = withZodValidation(TestSchema, { name: 123, age: 'abc' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Request validation failed');
    }
  });

  it('includes issue details in failure response', async () => {
    const result = withZodValidation(TestSchema, { name: '', age: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      expect(body.details?.issues).toBeDefined();
      expect(Array.isArray(body.details?.issues)).toBe(true);
    }
  });

  it('handles missing fields correctly', async () => {
    const result = withZodValidation(TestSchema, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('handles extra fields (passes through)', () => {
    const result = withZodValidation(TestSchema, {
      name: 'Bob',
      age: 25,
      extra: 'should be stripped',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Bob', age: 25 });
    }
  });
});
