export interface FileNode {
  path: string;
  name: string;
  size: number;
  isText: boolean;
}

interface FileSystemNode {
  _is_file?: boolean;
  size?: number;
  isText?: boolean;
  // Рекурсивная структура допускает примитивы
  [key: string]: FileSystemNode | boolean | number | undefined;
}

export function formatBytes(bytes: number, decimals = 0) {
  if (!+bytes) return '0B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
}

/**
 * Type Guard для проверки, является ли значение узлом дерева (объектом),
 * а не служебным полем (числом или булевым).
 */
function isDirectoryNode(value: unknown): value is FileSystemNode {
  return typeof value === 'object' && value !== null;
}

export function generateAsciiTree(files: FileNode[]): string {
  const root: FileSystemNode = {};

  files.forEach((node) => {
    const parts = node.path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = { _is_file: true, size: node.size, isText: node.isText };
      } else {
        // Безопасная навигация или инициализация
        const existing = current[part];
        if (isDirectoryNode(existing)) {
          current = existing;
        } else {
          const newNode: FileSystemNode = {};
          current[part] = newNode;
          current = newNode;
        }
      }
    });
  });

  let output = '';

  function traverse(node: FileSystemNode, depth: number) {
    const keys = Object.keys(node);

    keys.sort((a, b) => {
      const nodeA = node[a];
      const nodeB = node[b];

      // Безопасная проверка флага _is_file через optional chaining
      // Если это не объект, isDirectoryNode вернет false, но мы проверяем свойства напрямую у union type
      // Для сортировки нам нужно знать, файл это или папка.

      const aIsFile = isDirectoryNode(nodeA) && nodeA._is_file;
      const bIsFile = isDirectoryNode(nodeB) && nodeB._is_file;

      if (!aIsFile && bIsFile) return -1;
      if (aIsFile && !bIsFile) return 1;
      return a.localeCompare(b);
    });

    keys.forEach((key) => {
      // Пропускаем служебные ключи самого узла
      if (key === '_is_file' || key === 'size' || key === 'isText') return;

      const item = node[key];

      // FIX: Замена `as FileSystemNode` на Type Guard
      if (!isDirectoryNode(item)) {
        // Если встретили мусорные данные или примитив там, где не ждали — пропускаем
        return;
      }

      const indent = '  '.repeat(depth);

      if (item._is_file) {
        // FIX: Замена `item.size as number` на проверку или дефолтное значение
        const size = typeof item.size === 'number' ? item.size : 0;
        output += `${indent}${key} (${formatBytes(size)})\n`;
      } else {
        output += `${indent}${key}/\n`;
        traverse(item, depth + 1);
      }
    });
  }

  traverse(root, 0);
  return output;
}
