export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-4xl font-bold">О проекте</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">Концепция</h2>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          Conflux Data Lab — это персональный швейцарский нож для работы с данными и
          медиа-контентом. Проект создан как модульное портфолио, демонстрирующее навыки в
          веб-разработке, обработке данных и UX-дизайне.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-semibold">Технологический стек</h2>
        <ul className="grid grid-cols-2 gap-3">
          <li className="flex items-center gap-2">
            <span className="text-blue-600">▪</span> Next.js 16 (App Router)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-600">▪</span> React 19
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-600">▪</span> TypeScript
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-600">▪</span> Tailwind CSS 4
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-600">▪</span> Radix UI
          </li>
          <li className="flex items-center gap-2">
            <span className="text-blue-600">▪</span> Canvas API
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">Архитектура</h2>
        <p className="mb-3 leading-relaxed text-zinc-600 dark:text-zinc-400">
          Проект построен на принципах модульности и расширяемости. Каждый инструмент — это
          независимый компонент с собственной логикой и UI.
        </p>
        <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
          <li>✓ Централизованная конфигурация инструментов</li>
          <li>✓ Динамическая маршрутизация</li>
          <li>✓ Переиспользуемые UI-компоненты</li>
          <li>✓ Типобезопасность на всех уровнях</li>
        </ul>
      </section>
    </div>
  );
}
