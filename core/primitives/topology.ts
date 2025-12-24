/**
 * Оптимизирована для обхода больших структур данных без переполнения стека.
 */

export interface BaseNodeData {
  name: string;
}

export interface TreeNode<T extends BaseNodeData> {
  data: T;
  children: Map<string, TreeNode<T>>;
  isLeaf: boolean;
}

/**
 * TreeRegistry: Универсальный строитель иерархий.
 * T - тип метаданных узла.
 */
export class TreeRegistry<T extends BaseNodeData> {
  private root: TreeNode<T>;

  constructor(rootData: T) {
    this.root = { data: rootData, children: new Map(), isLeaf: false };
  }

  /**
   * Добавляет элемент в дерево. Разбирает путь итеративно.
   * Сложность: O(глубина пути).
   */
  public addByPath(path: string, leafData: T, createIntermediate: (name: string) => T): void {
    const segments = path.split('/');
    let current = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;

      const isLast = i === segments.length - 1;
      let next = current.children.get(segment);

      if (!next) {
        next = {
          data: isLast ? leafData : createIntermediate(segment),
          children: new Map(),
          isLeaf: isLast,
        };
        current.children.set(segment, next);
      }
      current = next;
    }
  }

  /**
   * Итератор по линиям дерева (DFS).
   * Не блокирует поток при сборке больших деревьев.
   */
  public *generateLines(visitor: (node: TreeNode<T>, depth: number) => string): Generator<string> {
    const stack: Array<{ node: TreeNode<T>; depth: number }> = [];

    const getSortedChildren = (node: TreeNode<T>) => {
      return Array.from(node.children.values()).sort((a, b) => {
        // Сортировка: Папки выше файлов, затем по алфавиту
        if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
        return a.data.name.localeCompare(b.data.name);
      });
    };

    const rootChildren = getSortedChildren(this.root);
    for (let i = rootChildren.length - 1; i >= 0; i--) {
      const child = rootChildren[i];
      if (child) stack.push({ node: child, depth: 0 });
    }

    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) continue;

      yield visitor(item.node, item.depth);

      const children = getSortedChildren(item.node);
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child) stack.push({ node: child, depth: item.depth + 1 });
      }
    }
  }

  /**
   * Сборка результирующей строки.
   */
  public render(visitor: (node: TreeNode<T>, depth: number) => string): string {
    let result = '';
    for (const line of this.generateLines(visitor)) {
      result += line;
    }
    return result;
  }

  public get rawRoot() {
    return this.root;
  }
}
