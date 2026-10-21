import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Swagger names each schema after its class. Two DTO classes with the same
// name silently overwrite each other in openapi.json, and the generated
// Dart client then gets the wrong fields for one of them.
describe('DTO class names', () => {
  it('are unique across the app', () => {
    const src = join(import.meta.dirname, '..');
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.dto.ts'))
      .map((file) => join(src, file));

    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [, name] of source.matchAll(/export class (\w+)/g)) {
        const other = seen.get(name);
        if (other) duplicates.push(`${name}: ${other} and ${file}`);
        seen.set(name, file);
      }
    }

    expect(duplicates).toEqual([]);
  });
});
