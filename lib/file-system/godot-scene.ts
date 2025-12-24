import { TreeRegistry } from '@/core/primitives/topology';

export interface GodotNodeMetadata {
  name: string;
  type: string;
  isResource: boolean;
}

/**
 * Парсер текстовых сцен Godot (.tscn).
 * Использует TreeRegistry для восстановления иерархии узлов.
 */
export class GodotSceneParser {
  public parse(content: string): string {
    // Корневой узел реестра — технический, он не выводится в render
    const registry = new TreeRegistry<GodotNodeMetadata>({
      name: 'Scene',
      type: 'Root',
      isResource: false,
    });

    const lines = content.split(/\r?\n/);

    // Карта для восстановления полных путей: ИмяУзла -> ПолныйПуть
    const nodePathMap = new Map<string, string>();
    let sceneRootName = '';

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('[node')) {
        const name = this.getAttr(trimmed, 'name') || 'Unnamed';
        const type = this.getAttr(trimmed, 'type') || 'Node';
        const parent = this.getAttr(trimmed, 'parent');

        let fullPath = '';

        if (!parent) {
          // Первый узел без родителя — это корень сцены
          sceneRootName = name;
          fullPath = name;
        } else {
          // Определяем имя родителя ('.' ссылается на корень сцены)
          const parentLookup = parent === '.' ? sceneRootName : parent;
          const parentPath = nodePathMap.get(parentLookup);

          // Строим путь для реестра: Parent/Child
          fullPath = parentPath ? `${parentPath}/${name}` : name;
        }

        // Сохраняем путь для будущих потомков
        nodePathMap.set(name, fullPath);

        registry.addByPath(fullPath, { name, type, isResource: false }, (n) => ({
          name: n,
          type: 'Node',
          isResource: false,
        }));
      } else if (trimmed.startsWith('[sub_resource') || trimmed.startsWith('[resource')) {
        const id = this.getAttr(trimmed, 'id') || 'res';
        const type = this.getAttr(trimmed, 'type') || 'Resource';
        const isSub = trimmed.startsWith('[sub_resource');

        // Ресурсы группируем в виртуальную ветку для порядка
        registry.addByPath(`Resources/${id}`, { name: id, type, isResource: true }, (n) => ({
          name: n,
          type: isSub ? 'SubResource' : 'Resource',
          isResource: true,
        }));
      }
    });

    // Рендерим дерево с использованием вычисленных отступов
    return registry.render((node, depth) => {
      const indent = '  '.repeat(depth);
      const { name, type, isResource } = node.data;

      // Если это промежуточный узел (например, папка Resources), просто выводим имя
      if (!node.isLeaf && !isResource && name === 'Resources') {
        return `${indent}${name}/\n`;
      }

      const typeStr = isResource ? `[Res: ${type}]` : `[${type}]`;
      return `${indent}${name} ${typeStr}\n`;
    });
  }

  /**
   * Извлекает значение атрибута из строки определения узла.
   */
  private getAttr(line: string, name: string): string | undefined {
    // Поиск в кавычках: name="Value"
    const match = new RegExp(`${name}="([^"]+)"`).exec(line);
    if (match) return match[1];

    // Поиск без кавычек (для id): id=1
    const matchNoQuote = new RegExp(`${name}=([^\\s\\]]+)`).exec(line);
    return matchNoQuote?.[1];
  }
}
