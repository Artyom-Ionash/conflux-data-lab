import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Получает размер файла в последнем коммите (HEAD).
 * Используется для вычисления "веса" изменений.
 */
export function getGitBlobSize(filePath: string): number {
  try {
    // git ls-tree возвращает размер в байтах для объекта
    const output = execSync(`git ls-tree -l HEAD "${filePath.replaceAll('\\', '/')}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    // Формат вывода: <mode> <type> <object> <size> <file>
    const match = output.trim().split(/\s+/);
    return match[3] && match[3] !== '-' ? Number.parseInt(match[3], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Рассчитывает разницу в размере (в байтах) между рабочей директорией и HEAD.
 * Возвращает отформатированную строку с ANSI-цветами.
 */
export function calculateGitDelta(rootDir: string): string {
  try {
    // --porcelain дает стабильный машиночитаемый формат
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    const lines = statusOutput.split('\n').filter((l) => l.trim());

    if (lines.length === 0) return '';

    let totalDelta = 0;

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      const fullPath = join(rootDir, filePath);

      // Status codes:
      // 'D ' - Deleted
      // ' M' - Modified
      // '??' - Untracked

      if (status.includes('D')) {
        totalDelta -= getGitBlobSize(filePath);
      } else if (existsSync(fullPath)) {
        // Для новых и измененных файлов: Текущий размер - Размер в git
        totalDelta += statSync(fullPath).size - getGitBlobSize(filePath);
      }
    }

    const sign = totalDelta > 0 ? '+' : '';
    // Красный если растем, Зеленый если уменьшаем долг (вес)
    const color = totalDelta > 0 ? '\x1b[31m' : '\x1b[32m';

    return ` | Pending Commit: ${color}${sign}${totalDelta} B\x1b[0m`;
  } catch {
    // Если git не установлен или не инициализирован
    return '';
  }
}
