import ignore from 'ignore';

import { LOCAL_CONTEXT_FOLDER, MANDATORY_REPO_FILES } from '../context-generator/rules';

export interface ScanOptions {
  ignorePatterns?: string[];
  gitIgnoreContent?: string | null;
}

export function createIgnoreManager(options: ScanOptions) {
  const ig = ignore();

  // 1. БАЗОВЫЕ ЗАПРЕТЫ (Самый низкий приоритет)
  ig.add(['node_modules', '.DS_Store', 'package-lock.json', 'yarn.lock']);

  // 2. КОНТЕНТ ИЗ .gitignore
  if (options.gitIgnoreContent) {
    ig.add(options.gitIgnoreContent);
  }

  // 3. КАСТОМНЫЕ ПАТТЕРНЫ ИЗ ПРЕСЕТОВ И UI
  if (options.ignorePatterns) {
    ig.add(options.ignorePatterns.filter(Boolean));
  }

  // 4. ПРИНУДИТЕЛЬНОЕ ВКЛЮЧЕНИЕ (Самый высокий приоритет)
  // Эти правила добавляются ПОСЛЕДНИМИ, чтобы перекрыть .gitignore
  if (MANDATORY_REPO_FILES.length > 0) {
    ig.add(MANDATORY_REPO_FILES.map((f) => `!${f}`));
  }

  // Разрешаем папку .ai
  ig.add(`!${LOCAL_CONTEXT_FOLDER}`);
  ig.add(`!${LOCAL_CONTEXT_FOLDER}/**`);

  // 5. ФИНАЛЬНЫЙ БАН (Исключение из исключений)
  // Гарантируем, что .git не попадет в контекст, даже если он внутри .ai
  ig.add(['.git', '.git/**']);

  return ig;
}
