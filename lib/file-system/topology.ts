import { TreeRegistry } from '@/core/primitives/topology';

/**
 * Стандартный интерфейс узла файла для всей системы.
 */
export interface FileNode {
  path: string;
  name: string;
  size: number;
  isText?: boolean;
}

/**
 * Вспомогательная функция для форматирования байтов.
 */
export function formatBytes(bytes: number, decimals = 0) {
  if (!+bytes) return '0B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
}

/**
 * Генерирует ASCII дерево проекта на основе универсального TreeRegistry.
 */
export function generateAsciiTree(files: FileNode[]): string {
  // Инициализируем реестр с корневыми данными
  const registry = new TreeRegistry<FileNode>({
    path: '',
    name: 'root',
    size: 0,
  });

  // Заполняем данными
  for (const file of files) {
    registry.addByPath(
      file.path,
      file, // Данные для листа (файла)
      (folderName) => ({ path: '', name: folderName, size: 0 }) // Данные для промежуточных папок
    );
  }

  // Рендерим структуру
  return registry.render((node, depth) => {
    const indent = '  '.repeat(depth);
    if (node.isLeaf) {
      return `${indent}${node.data.name} (${formatBytes(node.data.size)})\n`;
    }
    return `${indent}${node.data.name}/\n`;
  });
}
