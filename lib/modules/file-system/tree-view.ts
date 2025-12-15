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

export function generateAsciiTree(files: FileNode[]): string {
  const root: FileSystemNode = {};

  files.forEach((node) => {
    const parts = node.path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = { _is_file: true, size: node.size, isText: node.isText };
      } else {
        if (!current[part]) current[part] = {};
        current = current[part] as FileSystemNode;
      }
    });
  });

  let output = '';
  function traverse(node: FileSystemNode, depth: number) {
    const keys = Object.keys(node);

    keys.sort((a, b) => {
      const nodeA = node[a] as FileSystemNode | undefined;
      const nodeB = node[b] as FileSystemNode | undefined;
      const aIsFile = nodeA?._is_file;
      const bIsFile = nodeB?._is_file;
      if (!aIsFile && bIsFile) return -1;
      if (aIsFile && !bIsFile) return 1;
      return a.localeCompare(b);
    });

    keys.forEach((key) => {
      if (key === '_is_file' || key === 'size' || key === 'isText') return;
      const item = node[key] as FileSystemNode;
      const indent = '  '.repeat(depth);
      if (item._is_file) {
        output += `${indent}${key} (${formatBytes(item.size as number)})\n`;
      } else {
        output += `${indent}${key}/\n`;
        traverse(item, depth + 1);
      }
    });
  }
  traverse(root, 0);
  return output;
}
