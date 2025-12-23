import { useCallback, useState } from 'react';

/**
 * [КРИСТАЛЛ] useCopyToClipboard
 * Самая надежная реализация копирования.
 *
 * Особенности:
 * 1. Использование Clipboard API (Secure Context).
 * 2. Робастный фоллбек через скрытый textarea (Insecure Context/Legacy).
 * 3. Отсутствие влияния на layout и scroll.
 * 4. Предотвращение вызова экранной клавиатуры на мобилках при фоллбеке.
 */
export function useCopyToClipboard(resetDelay = 2000) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (typeof window === 'undefined' || !text) return false;

      // --- ПУТЬ А: Современный API (рекомендуемый) ---
      // Работает только в Secure Context (HTTPS/Localhost)
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), resetDelay);
          return true;
        } catch (err) {
          console.warn('Clipboard API failed, using fallback.', err);
        }
      }

      // --- ПУТЬ Б: Фоллбек через execCommand ---
      // Необходим для HTTP соединений и старых браузеров
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;

        // Настройка абсолютной невидимости
        textArea.setAttribute('readonly', ''); // Предотвращает клавиатуру на iOS
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('aria-hidden', 'true');

        document.body.append(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        textArea.remove();

        if (successful) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), resetDelay);
          return true;
        }
      } catch (err) {
        console.error('All copy methods failed:', err);
      }

      return false;
    },
    [resetDelay]
  );

  return { isCopied, copy };
}
