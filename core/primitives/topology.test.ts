import { describe, expect, it } from 'vitest';

import { TreeRegistry } from './topology';

interface MockMetadata {
  name: string;
  size?: number;
  type?: string;
}

describe('TreeRegistry (Universal Topology)', () => {
  it('should build a simple nested structure', () => {
    const registry = new TreeRegistry<MockMetadata>({ name: 'root' });

    registry.addByPath('src/index.ts', { name: 'index.ts', size: 100 }, (name) => ({ name }));

    const result = registry.render((node, depth) => {
      return `${' '.repeat(depth)}${node.data.name}${node.isLeaf ? '' : '/'}\n`;
    });

    // Ожидаем:
    // src/
    //  index.ts
    expect(result).toBe('src/\n index.ts\n');
  });

  it('should enforce sorting: folders first, then alphabetical', () => {
    const registry = new TreeRegistry<MockMetadata>({ name: 'root' });

    // Добавляем вперемешку
    registry.addByPath('docs.txt', { name: 'docs.txt' }, (n) => ({ name: n }));
    registry.addByPath('assets/logo.png', { name: 'logo.png' }, (n) => ({ name: n }));
    registry.addByPath('src/main.ts', { name: 'main.ts' }, (n) => ({ name: n }));
    registry.addByPath('about.txt', { name: 'about.txt' }, (n) => ({ name: n }));

    const result = registry.render((node) => `${node.data.name}|`);

    // Логика сортировки:
    // 1. assets (folder)
    // 2. logo.png (file in assets)
    // 3. src (folder)
    // 4. main.ts (file in src)
    // 5. about.txt (file)
    // 6. docs.txt (file)
    expect(result).toBe('assets|logo.png|src|main.ts|about.txt|docs.txt|');
  });

  it('should handle deep paths and intermediate nodes', () => {
    const registry = new TreeRegistry<MockMetadata>({ name: 'root' });

    registry.addByPath('a/b/c/d.txt', { name: 'd.txt', size: 1 }, (name) => ({
      name,
      type: 'folder',
    }));

    const nodes: string[] = [];
    for (const line of registry.generateLines((n) => n.data.name)) {
      nodes.push(line);
    }

    expect(nodes).toEqual(['a', 'b', 'c', 'd.txt']);
  });

  it('should preserve custom metadata in leaf nodes', () => {
    const registry = new TreeRegistry<MockMetadata>({ name: 'root' });

    registry.addByPath('config.json', { name: 'config.json', size: 500, type: 'json' }, (n) => ({
      name: n,
    }));

    const rootChildren = Array.from(registry.rawRoot.children.values());
    const leaf = rootChildren[0];

    expect(leaf?.isLeaf).toBe(true);
    expect(leaf?.data.size).toBe(500);
    expect(leaf?.data.type).toBe('json');
  });

  it('should handle empty segments and multiple slashes gracefully', () => {
    const registry = new TreeRegistry<MockMetadata>({ name: 'root' });

    // Путь с лишними слэшами: ///src//app.ts
    registry.addByPath('///src//app.ts', { name: 'app.ts' }, (n) => ({ name: n }));

    const result = registry.render((n) => n.data.name);
    expect(result).toBe('srcapp.ts');
  });

  it('should be stack-safe for very deep trees (DFS iteration test)', () => {
    const registry = new TreeRegistry<MockMetadata>({ name: 'root' });
    const depth = 1000;

    // Создаем очень глубокий путь
    const deepPath = Array.from({ length: depth }, (_, i) => `dir${i}`).join('/') + '/file.txt';

    expect(() => {
      registry.addByPath(deepPath, { name: 'file.txt' }, (n) => ({ name: n }));
      registry.render((n) => n.data.name);
    }).not.toThrow();
  });
});
