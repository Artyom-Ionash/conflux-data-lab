
"use client";

import { Card } from "../../ui/Card";
import { useVideoFrameExtraction } from "./hooks/useVideoFrameExtraction";
import { RangeVideoPlayer } from "./RangeVideoPlayer";
import { FrameDiffOverlay } from "./FrameDiffOverlay";
import { SpriteSheetManager } from "./SpriteSheetManager";
import { FileInput } from "./FileInput";
import { TimeRangeSlider } from "./TimeRangeSlider";
import { NumberInput } from "./NumberInput";
import { ErrorMessage } from "./ErrorMessage";
import { FrameItem } from "./FrameItem";

export function VideoFrameExtractor() {
  const {
    videoRef,
    canvasRef,
    videoSrc,
    videoDuration,
    extractionParams,
    frames,
    gifParams,
    status,
    errors,
    effectiveEnd,
    frameCount,
    showDiffOverlay,
    handleFileChange,
    extractFramesAndGenerateGif,
    downloadFrame,
    downloadGif,
    handleTimeChange,
    setExtractionParams,
    setGifParams,
    getButtonText,
  } = useVideoFrameExtraction();

  return (
    <div className="flex min-h-[80vh] flex-col space-y-6">
      <div className="space-y-6">
        <Card>
          <div className="space-y-4">
            <FileInput onChange={handleFileChange} />

            {videoSrc && (
              <div className="grid gap-4 md:grid-cols-2 items-start">
                <RangeVideoPlayer
                  src={videoSrc}
                  startTime={extractionParams.startTime}
                  endTime={effectiveEnd}
                />

                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-md bg-black aspect-video flex items-center justify-center">
                    {gifParams.dataUrl ? (
                      <img
                        src={gifParams.dataUrl}
                        alt="GIF preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <p className="px-3 text-center text-xs text-zinc-400">
                        {status.isProcessing
                          ? (status.currentStep === "generating"
                            ? "Создание GIF..."
                            : "Обработка...")
                          : "GIF появится здесь после генерации."}
                      </p>
                    )}
                  </div>

                  {gifParams.dataUrl && (
                    <button
                      onClick={downloadGif}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Скачать GIF
                    </button>
                  )}
                </div>
              </div>
            )}

            <TimeRangeSlider
              startTime={extractionParams.startTime}
              endTime={effectiveEnd}
              duration={videoDuration}
              onTimeChange={handleTimeChange}
            />

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Шаг между кадрами (сек)"
                  value={extractionParams.frameStep}
                  min={0.01}
                  step={0.01}
                  onChange={(value) => setExtractionParams(prev => ({ ...prev, frameStep: value }))}
                />
                <NumberInput
                  label="Скорость GIF (кадров/сек)"
                  value={gifParams.fps}
                  min={0.5}
                  max={30}
                  step={0.5}
                  onChange={(fps) => setGifParams(prev => ({ ...prev, fps }))}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={extractionParams.symmetricLoop}
                  onChange={(e) =>
                    setExtractionParams(prev => ({ ...prev, symmetricLoop: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                />
                <span>
                  Симметричный набор кадров для точного зацикливания (туда-обратно)
                </span>
              </label>
            </div>

            {errors.extraction && <ErrorMessage message={errors.extraction} />}
            {errors.gif && <ErrorMessage message={errors.gif} />}

            <div className="space-y-2">
              <button
                onClick={extractFramesAndGenerateGif}
                disabled={status.isProcessing || !videoSrc}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getButtonText()}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* СЕКЦИЯ: Разница кадров (Обновленная логика показа) */}
      {showDiffOverlay && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Анализ изменений между кадрами
            </h3>
            {/* Передаем флаг isExtracting для отображения лоадера поверх старого изображения */}
            <FrameDiffOverlay
              frames={frames}
              isExtracting={status.isProcessing && status.currentStep === 'extracting'}
            />
          </div>
        </Card>
      )}

      {/* Список кадров */}
      <Card className="flex min-h-[220px] flex-1 flex-col gap-4">
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Извлечённые кадры ({frameCount})
            </h3>
          </div>

          {frames.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {status.isProcessing && status.currentStep === "extracting"
                ? "Извлечение кадров..."
                : "Кадры появятся здесь после извлечения."}
            </p>
          ) : (
            <div className="flex h-full items-stretch gap-3 overflow-x-auto overflow-y-hidden pr-1 pb-1">
              {frames.map((frame, index) => (
                <FrameItem
                  key={index}
                  frame={frame}
                  index={index}
                  onDownload={() => downloadFrame(frame, index)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Спрайт-лист */}
      {frames.length > 0 && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Спрайт-лист для анимации (PNG)
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Создайте горизонтальное изображение со всеми кадрами для использования в игровых движках или CSS-анимациях
            </p>
            <SpriteSheetManager frames={frames} />
          </div>
        </Card>
      )}

      <video ref={videoRef} className="hidden" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}