import ignore from 'ignore';

import { LOCAL_CONTEXT_FOLDER, MANDATORY_REPO_FILES } from '@/lib/context-generator/rules';

export interface IgnoreOptions {
  ignorePatterns?: string[];
  gitIgnoreContent?: string | null;
}

/**
 * Фабрика менеджера игнорирования.
 * Централизует логику того, что считается "мусором" в проекте.
 */
export function createIgnoreManager(options: IgnoreOptions) {
  const ig = ignore();

  // 1. БАЗОВЫЕ ТЕХНИЧЕСКИЕ ПАПКИ
  ig.add(['node_modules', '.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.git']);

  // 2. .gitignore
  if (options.gitIgnoreContent) {
    ig.add(options.gitIgnoreContent);
  }

  // 3. ПРЕСЕТЫ И КАСТОМНЫЕ ПАТТЕРНЫ
  if (options.ignorePatterns) {
    ig.add(options.ignorePatterns.filter(Boolean));
  }

  // 4. БЕЛЫЙ СПИСОК (Exceptions)
  // Важные файлы, которые должны быть включены вопреки gitignore
  if (MANDATORY_REPO_FILES.length > 0) {
    ig.add(MANDATORY_REPO_FILES.map((f) => `!${f}`));
  }

  // Разрешаем папку контекста (она часто в gitignore, но нам нужна)
  ig.add(`!${LOCAL_CONTEXT_FOLDER}`);
  ig.add(`!${LOCAL_CONTEXT_FOLDER}/**`);

  // 5. ФИНАЛЬНЫЙ БЛОК
  // .git внутри .ai не должен попасть
  ig.add(['.git/**']);

  return ig;
}
