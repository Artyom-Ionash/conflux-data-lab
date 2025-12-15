export interface GodotNode {
  name: string;
  type: string;
  parentPath: string | null;
  properties: Record<string, string>;
  children: GodotNode[];
  isResource: boolean;
  fullPath?: string;
}

export class GodotSceneParser {
  private nodes: GodotNode[] = [];
  private rootNodes: GodotNode[] = [];

  public parse(content: string): string {
    this.reset();
    const lines = content.split(/\r?\n/);

    let currentNode: GodotNode | null = null;
    let sectionType: 'node' | 'resource' | 'other' | null = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const attrs = this.parseHeaderAttributes(trimmed);

        if (trimmed.startsWith('[node')) {
          sectionType = 'node';
          currentNode = this.createNode(attrs, false);
          this.nodes.push(currentNode);
        } else if (trimmed.startsWith('[sub_resource') || trimmed.startsWith('[resource')) {
          sectionType = 'resource';
          currentNode = this.createNode(attrs, true);
          this.nodes.push(currentNode);
        } else {
          sectionType = 'other';
          currentNode = null;
        }
        return;
      }

      if (sectionType && currentNode && trimmed.includes('=')) {
        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        currentNode.properties[key] = value;
      }
    });

    this.buildTree();
    return this.stringifyTree();
  }

  private reset(): void {
    this.nodes = [];
    this.rootNodes = [];
  }

  private parseHeaderAttributes(line: string): Record<string, string> {
    const content = line.trim().slice(1, -1);
    const props: Record<string, string> = {};
    let token = '';
    let inQuote = false,
      arrayDepth = 0,
      funcDepth = 0;

    for (const char of content) {
      if (char === '"') inQuote = !inQuote;
      if (char === '[') arrayDepth++;
      if (char === ']') arrayDepth--;
      if (char === '(') funcDepth++;
      if (char === ')') funcDepth--;

      if (char === ' ' && !inQuote && arrayDepth === 0 && funcDepth === 0) {
        if (token) this.processToken(token, props);
        token = '';
      } else {
        token += char;
      }
    }
    if (token) this.processToken(token, props);
    return props;
  }

  private processToken(token: string, props: Record<string, string>): void {
    const eqIndex = token.indexOf('=');
    if (eqIndex > 0) {
      props[token.substring(0, eqIndex)] = token.substring(eqIndex + 1);
    }
  }

  private createNode(attrs: Record<string, string>, isResource: boolean): GodotNode {
    const name = (isResource ? attrs.id : attrs.name)?.replace(/"/g, '') || 'Unnamed';
    return {
      name,
      type: attrs.type?.replace(/"/g, '') || (isResource ? 'Resource' : 'Node'),
      parentPath: attrs.parent?.replace(/"/g, '') || null,
      properties: {},
      children: [],
      isResource,
    };
  }

  private buildTree(): void {
    const nodeMap = new Map<string, GodotNode>();
    const sceneNodes = this.nodes.filter((n) => !n.isResource);

    // 1. Identify the Scene Root (node with no parent)
    const root = sceneNodes.find((n) => !n.parentPath);
    if (root) {
      root.fullPath = '.';
      this.rootNodes.push(root);
      nodeMap.set('.', root);
    }

    // 2. Process children
    sceneNodes.forEach((node) => {
      // Skip the root (already handled)
      if (!node.parentPath) return;

      const parentNode = nodeMap.get(node.parentPath);

      if (parentNode) {
        parentNode.children.push(node);

        // Construct the path for THIS node so its children can find it
        const myPath = node.parentPath === '.' ? node.name : `${node.parentPath}/${node.name}`;

        nodeMap.set(myPath, node);
      } else {
        // Fallback: orphan node
        this.rootNodes.push(node);
      }
    });

    // 3. Add resources at the end
    this.nodes.filter((n) => n.isResource).forEach((res) => this.rootNodes.push(res));
  }

  private stringifyTree(): string {
    const formatNode = (node: GodotNode, depth: number): string => {
      const indent = '  '.repeat(depth);
      const typeStr = node.isResource ? `[Res: ${node.type}]` : `[${node.type}]`;
      let res = `${indent}${node.name} ${typeStr}\n`;

      node.children.forEach((child) => {
        res += formatNode(child, depth + 1);
      });
      return res;
    };

    // Join with empty string because formatNode already adds \n
    return this.rootNodes.map((root) => formatNode(root, 0)).join('');
  }
}
