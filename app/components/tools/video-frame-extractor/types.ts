"use client";

export interface ExtractedFrame {
  time: number;
  dataUrl: string;
}

export type ExtractionStep = "extracting" | "generating" | "";

export interface ExtractionParams {
  startTime: number;
  endTime: number;
  frameStep: number;
  symmetricLoop: boolean;
}

export interface GifParams {
  fps: number;
  dataUrl: string | null;
}

export interface ExtractionStatus {
  isProcessing: boolean;
  currentStep: ExtractionStep;
}

export interface ExtractionErrors {
  extraction: string;
  gif: string;
}


