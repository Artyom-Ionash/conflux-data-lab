'use client';

import React, { useEffect, useState } from 'react';

import { useCopyToClipboard } from '@/core/react/hooks/use-copy';
import { useTask } from '@/core/react/hooks/use-task';
import { GEMINI_MODELS, streamOpenRouterCompletion } from '@/lib/llm/openrouter';
import { Card } from '@/ui/atoms/container/Card';
import { StatusBox } from '@/ui/atoms/container/StatusBox';
import { Alert } from '@/ui/atoms/feedback/Alert';
import { Field } from '@/ui/atoms/input/Field';
import { TextArea, TextInput } from '@/ui/atoms/input/Input';
import { ToggleGroup, ToggleGroupItem } from '@/ui/atoms/input/ToggleGroup';
import { Grid, Stack } from '@/ui/atoms/layout/Layout';
import { Typography } from '@/ui/atoms/primitive/Typography';
import { Section } from '@/ui/molecules/container/Section';
import { ResultViewer } from '@/ui/molecules/display/ResultViewer';
import { ProcessingOverlay } from '@/ui/molecules/feedback/ProcessingOverlay';
import { Button } from '@/ui/molecules/input/Button';
import { Workbench } from '@/ui/molecules/layout/Workbench';

const DEFAULT_SYSTEM_PROMPT =
  'You are a Context Sculptor. Your task is to analyze the provided codebase context and optimize it for a specific goal. Remove redundant comments, irrelevant files, and whitespace. Keep only the essential logic and interfaces. Output valid Markdown.';

export function ContextSculptor() {
  // --- STATE ---
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(GEMINI_MODELS[0].id);
  const [inputContext, setInputContext] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [streamedOutput, setStreamedOutput] = useState('');

  // --- PERSISTENCE ---
  useEffect(() => {
    // FIX: Оборачиваем в RAF, чтобы избежать синхронного обновления стейта внутри эффекта.
    // Это переносит чтение на следующий тик анимации, устраняя ошибку каскадного рендера.
    const rafId = requestAnimationFrame(() => {
      const storedKey = localStorage.getItem('openrouter_key');
      if (storedKey) setApiKey(storedKey);
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('openrouter_key', val);
  };

  // --- TASK ---
  const { run, reset, isRunning, error } = useTask(
    async ({ signal }, context: string, prompt: string, key: string, model: string) => {
      setStreamedOutput('');

      await streamOpenRouterCompletion(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: context },
        ],
        { apiKey: key, model },
        (chunk) => {
          setStreamedOutput((prev) => prev + chunk);
        },
        signal
      );

      return true;
    }
  );

  const handleSculpt = () => {
    if (!apiKey) return alert('Введите API ключ OpenRouter');
    if (!inputContext) return alert('Введите контекст для обработки');
    void run(inputContext, systemPrompt, apiKey, selectedModel);
  };

  const { isCopied, copy } = useCopyToClipboard();

  // --- RENDER ---
  const sidebarContent = (
    <Stack gap={6}>
      <Workbench.Header title="Context Sculptor" />

      <Section title="Конфигурация">
        <Stack gap={4}>
          <Field label="OpenRouter API Key">
            <TextInput
              type="password"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
            />
          </Field>

          <Field label="Модель (Gemini)">
            <ToggleGroup
              type="single"
              value={selectedModel}
              onValueChange={(val) => val && setSelectedModel(val)}
              gridCols={1}
            >
              {GEMINI_MODELS.map((m) => (
                <ToggleGroupItem key={m.id} value={m.id} className="justify-start">
                  <Stack gap={0} items="start">
                    {/* Замена <span className="font-semibold"> */}
                    <Typography.Text weight="medium">{m.name}</Typography.Text>

                    {/* Замена <span className="text-[10px] opacity-60"> */}
                    <Typography.Text variant="dimmed" size="xs">
                      CTX: {(m.context / 1000).toFixed(0)}k
                    </Typography.Text>
                  </Stack>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </Stack>
      </Section>

      <Section title="Инструкция (System Prompt)">
        <TextArea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          className="text-xs"
        />
      </Section>

      {error && <Alert variant="error">{error.message}</Alert>}

      <StatusBox>
        <Button
          onClick={handleSculpt}
          disabled={isRunning || !apiKey || !inputContext}
          className="w-full"
          size="lg"
        >
          {isRunning ? 'Скульптурирование...' : 'Запустить Обработку'}
        </Button>
        {isRunning && (
          <Button variant="destructive" size="sm" className="mt-2 w-full" onClick={reset}>
            Прервать
          </Button>
        )}
      </StatusBox>
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <Workbench.Content>
          <Grid className="h-full grid-cols-1 lg:grid-cols-2" gap={4}>
            {/* INPUT PANEL */}
            <Card
              title="Исходный Контекст"
              className="flex flex-col overflow-hidden"
              contentClassName="p-0 flex-1 flex flex-col min-h-0"
              headerActions={
                <Typography.Text variant="dimmed" size="xs" className="font-mono">
                  {inputContext.length} chars
                </Typography.Text>
              }
            >
              <TextArea
                value={inputContext}
                onChange={(e) => setInputContext(e.target.value)}
                placeholder="Вставьте сюда project.txt или код..."
                className="flex-1 resize-none rounded-none border-0 bg-transparent p-4 font-mono text-[11px] leading-relaxed focus:ring-0"
              />
            </Card>

            {/* OUTPUT PANEL */}
            <ResultViewer
              title="Результат"
              value={streamedOutput}
              isCopied={isCopied}
              onCopy={copy}
              placeholder="Здесь появится обработанный контекст..."
              className="flex-1"
              footer={
                streamedOutput && (
                  <Stack gap={2} className="px-4 py-2">
                    <Typography.Text size="xs" variant="dimmed">
                      Сжатие:{' '}
                      {((1 - streamedOutput.length / (inputContext.length || 1)) * 100).toFixed(1)}%
                    </Typography.Text>
                  </Stack>
                )
              }
            />
          </Grid>
        </Workbench.Content>

        {/* Loading Overlay only if needed, usually streaming is enough indication */}
        <ProcessingOverlay isVisible={false} />
      </Workbench.Stage>
    </Workbench.Root>
  );
}
