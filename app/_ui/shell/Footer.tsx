export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:border-zinc-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            © {new Date().getFullYear()} Conflux Data Lab. Портфолио инструментов для обработки
            данных.
          </p>
        </div>
      </div>
    </footer>
  );
}
