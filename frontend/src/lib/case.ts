/**
 * Key-case translation between the frontend (camelCase) and the API (snake_case).
 *
 * The API client applies these automatically, so components and forms only ever
 * deal with camelCase and nobody has to remember which style an endpoint uses.
 */

const toSnake = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toCamel = (key: string): string =>
  key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());

/** Values we must hand through untouched rather than walking into. */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof File) &&
  !(value instanceof Blob) &&
  !(value instanceof FormData);

function convertKeys<T>(value: T, transform: (key: string) => string): T {
  if (Array.isArray(value)) {
    return value.map((item) => convertKeys(item, transform)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[transform(key)] = convertKeys(nested, transform);
    }
    return result as unknown as T;
  }
  return value;
}

/** `{ patientId: 1 }` -> `{ patient_id: 1 }` (outgoing request bodies/params). */
export const keysToSnakeCase = <T>(value: T): T => convertKeys(value, toSnake);

/** `{ patient_id: 1 }` -> `{ patientId: 1 }` (incoming responses). */
export const keysToCamelCase = <T>(value: T): T => convertKeys(value, toCamel);
