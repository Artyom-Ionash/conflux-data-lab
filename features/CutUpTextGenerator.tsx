'use client';

import { useCallback, useState } from 'react';

import { downloadText } from '@/core/browser/canvas';
import { useCopyToClipboard } from '@/core/react/hooks/use-copy';
import type { CutUpMode } from '@/lib/converters/cut-up';
import { downloadDocx, extractTextFromFile, generateCutUpText } from '@/lib/converters/cut-up';
import { Card } from '@/ui/atoms/container/Card';
import { PanelHeader } from '@/ui/atoms/container/Panel';
import { Alert } from '@/ui/atoms/feedback/Alert';
import { Field } from '@/ui/atoms/input/Field';
import { TextArea } from '@/ui/atoms/input/Input';
import { NumberStepper } from '@/ui/atoms/input/NumberStepper';
import { TextOutput } from '@/ui/atoms/input/TextOutput';
import { ToggleGroup, ToggleGroupItem } from '@/ui/atoms/input/ToggleGroup';
import { Grid, Group, Stack } from '@/ui/atoms/layout/Layout';
import { Icon } from '@/ui/atoms/primitive/Icon';
import { Button, CopyButton } from '@/ui/molecules/input/Button';
import { Workbench } from '@/ui/molecules/layout/Workbench';

import { SidebarIO } from './_io/SidebarIO';

const DEFAULT_TEXT_1 = `When you cut up your text in pieces and rearrange them,
new meanings emerge from the chaos.
William S. Burroughs and Brion Gysin pioneered this technique.
Words have a spirit of their own and want to be free.`;

const DEFAULT_TEXT_2 = `The blue train races through the midnight rain.
Static echoes in the corridor of time.
A sudden flash of lightning reveals the forgotten map.`;

export function CutUpTextGenerator() {
  const [texts, setTexts] = useState<string[]>([DEFAULT_TEXT_1, DEFAULT_TEXT_2]);
  const [mode, setMode] = useState<CutUpMode>('lines');
  const [chunkSize, setChunkSize] = useState<number>(3);
  const [seed, setSeed] = useState<number>(0);
  const [error, setError] = useState('');

  const [output, setOutput] = useState(() => {
    try {
      return generateCutUpText([DEFAULT_TEXT_1, DEFAULT_TEXT_2], {
        mode: 'lines',
        chunkSize: 3,
        seed: 0,
      });
    } catch {
      return '';
    }
  });

  const { isCopied, copy } = useCopyToClipboard();

  const handleGenerate = (
    currTexts = texts,
    currMode = mode,
    currChunk = chunkSize,
    currSeed = seed
  ) => {
    try {
      setError('');
      if (currTexts.every((t) => !t.trim())) {
        setOutput('');
        return;
      }
      const result = generateCutUpText(currTexts, {
        mode: currMode,
        chunkSize: currChunk,
        seed: currSeed,
      });
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка генерации Cut-Up');
      setOutput('');
    }
  };

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      try {
        const content = await extractTextFromFile(file);
        const updatedTexts = [...texts, content];
        setTexts(updatedTexts);
        try {
          setError('');
          const result = generateCutUpText(updatedTexts, {
            mode,
            chunkSize,
            seed,
          });
          setOutput(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Ошибка генерации Cut-Up');
          setOutput('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось прочитать файл');
      }
    },
    [texts, mode, chunkSize, seed]
  );

  const setTextsSafe = (newTexts: string[]) => {
    setTexts(newTexts);
    handleGenerate(newTexts, mode, chunkSize, seed);
  };

  const handleDownloadTxt = () => {
    if (output) {
      downloadText(output, 'cut-up-result.txt');
    }
  };

  const handleDownloadDocx = () => {
    if (output) {
      void downloadDocx(output, 'cut-up-result.docx');
    }
  };

  const handleReshuffle = () => {
    const newSeed = seed + 1;
    setSeed(newSeed);
    handleGenerate(texts, mode, chunkSize, newSeed);
  };

  const handleAddText = () => {
    const newTexts = [...texts, ''];
    setTextsSafe(newTexts);
  };

  const handleRemoveText = (index: number) => {
    if (texts.length <= 1) return;
    const newTexts = texts.filter((_, i) => i !== index);
    setTextsSafe(newTexts);
  };

  const handleTextChange = (index: number, val: string) => {
    const newTexts = [...texts];
    newTexts[index] = val;
    setTextsSafe(newTexts);
  };

  const sidebarContent = (
    <Stack gap={6}>
      <Workbench.Header title="Cut-Up Generator" />

      <SidebarIO
        onFilesSelected={handleFilesSelected}
        accept=".txt,.md,.json,.docx"
        dropLabel="Загрузить текст / DOCX"
        hasFiles={!!output}
        onDownload={handleDownloadTxt}
        downloadLabel=".TXT"
      />

      <Stack gap={4}>
        <Field label="Метод Cut-Up">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(val) => {
              if (val) {
                const newMode = val as CutUpMode;
                setMode(newMode);
                handleGenerate(texts, newMode, chunkSize, seed);
              }
            }}
            gridCols={3}
          >
            <ToggleGroupItem value="lines" className="justify-center text-xs">
              Строки
            </ToggleGroupItem>
            <ToggleGroupItem value="words" className="justify-center text-xs">
              Слова
            </ToggleGroupItem>
            <ToggleGroupItem value="chunks" className="justify-center text-xs">
              Чанки
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>

        {mode === 'chunks' && (
          <Field label="Размер чанка (слов)">
            <NumberStepper
              value={chunkSize}
              min={1}
              max={20}
              step={1}
              onChange={(val) => {
                setChunkSize(val);
                handleGenerate(texts, mode, val, seed);
              }}
            />
          </Field>
        )}

        <Button onClick={handleReshuffle} variant="outline" className="w-full">
          Перемешать (Обновить сид)
        </Button>

        <Button onClick={handleAddText} variant="secondary" className="w-full">
          + Добавить источник текста
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <Workbench.Content>
          <Grid className="h-full grid-cols-1 lg:grid-cols-2" gap={4}>
            {/* Input Column with multiple source text cards */}
            <Stack gap={4} className="h-full overflow-y-auto pr-1">
              {texts.map((t, idx) => (
                <Card
                  key={idx}
                  className="flex flex-col overflow-hidden"
                  contentClassName="p-0 flex flex-col"
                >
                  <PanelHeader
                    title={`Источник #${idx + 1}`}
                    action={
                      texts.length > 1 ? (
                        <Button
                          onClick={() => handleRemoveText(idx)}
                          variant="destructive"
                          size="xs"
                        >
                          Удалить
                        </Button>
                      ) : undefined
                    }
                  />

                  <TextArea
                    value={t}
                    onChange={(e) => handleTextChange(idx, e.target.value)}
                    placeholder={`Введите текст #${idx + 1}...`}
                    rows={4}
                    className="resize-y border-0 p-3 font-mono text-xs focus:ring-0"
                  />
                </Card>
              ))}

              {error && <Alert variant="error">{error}</Alert>}
            </Stack>

            {/* Output Column */}
            <Card
              title="Cut-Up Результат"
              className="flex flex-1 flex-col overflow-hidden"
              contentClassName="p-0 flex-1 flex flex-col overflow-hidden"
              headerActions={
                output ? (
                  <Group gap={2}>
                    <CopyButton
                      onCopy={() => copy(output)}
                      isCopied={isCopied}
                      variant="outline"
                      size="xs"
                    />
                    <Button onClick={handleDownloadTxt} variant="default" size="xs">
                      <Icon.Download className="mr-1.5 h-3 w-3" />
                      .TXT
                    </Button>
                    <Button onClick={handleDownloadDocx} variant="default" size="xs">
                      <Icon.Download className="mr-1.5 h-3 w-3" />
                      .DOCX
                    </Button>
                  </Group>
                ) : null
              }
            >
              <Stack gap={0} className="min-h-0 flex-1 bg-white dark:bg-zinc-950">
                <TextOutput
                  value={output || ''}
                  placeholder="Результат появится здесь..."
                  className="flex-1"
                />
              </Stack>
            </Card>
          </Grid>
        </Workbench.Content>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
