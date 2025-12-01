// types/gifshot.d.ts
declare module 'gifshot' {
  /**
   * Options for gif creation.
   * Many options are optional and implementation-specific; add fields as needed.
   */
  export interface CreateGIFOptions {
    // Dimensions
    gifWidth?: number;
    gifHeight?: number;

    // Source images: data URLs, blob URLs or normal image URLs
    images?: string[];

    // Video/camera related
    video?: HTMLVideoElement | string; // element or selector or URL
    cameraStream?: MediaStream;

    // Frame / timing controls
    interval?: number; // seconds between frames (or frame interval)
    numFrames?: number;
    frameDuration?: number; // ms per frame
    sampleInterval?: number;

    // Quality / color
    gifQuality?: number; // 1-100 or implementation-specific
    numWorkers?: number;
    palette?: string | string[];

    // Text overlay / rendering
    text?: string;
    textX?: number;
    textY?: number;
    textFont?: string;
    textSize?: number;
    textColor?: string;

    // Output / format
    keepCameraOn?: boolean;
    progressCallback?: (progress: number) => void;

    // Fallbacks / misc
    error?: (err: any) => void;

    // Any other provider-specific options
    [key: string]: any;
  }

  /**
   * Result returned in createGIF callback.
   * error: boolean is the most common pattern (true when failed).
   * Some implementations may include errorMsg or errorCode.
   */
  export interface CreateGIFResult {
    error: boolean | string | null; // allow union in case some versions return string
    errorMsg?: string;
    errorCode?: string | number;
    // Base64 data URL of generated GIF
    image?: string;
    // Blob or ArrayBuffer could be present in custom builds
    blob?: Blob;
    // Additional fields
    [key: string]: any;
  }

  /**
   * Callback type for createGIF.
   */
  export type CreateGIFCallback = (obj: CreateGIFResult) => void;

  /**
   * Partial API surface of gifshot (extend as needed).
   */
  export interface GifshotStatic {
    /**
     * Create a GIF. The callback receives CreateGIFResult.
     */
    createGIF(options: CreateGIFOptions, callback: CreateGIFCallback): void;

    /**
     * Alternative names / aliases sometimes exist in different builds.
     * Keep these as any to be tolerant.
     */
    createGIFFromImage?: (options: CreateGIFOptions, callback: CreateGIFCallback) => void;
    createGIFFromVideo?: (options: CreateGIFOptions, callback: CreateGIFCallback) => void;

    /**
     * Utility / housekeeping methods that appear in some builds.
     */
    clearGifshotCache?: () => void;
    reset?: () => void;
    uploadImage?: (file: File | Blob, callback?: (url: string) => void) => void;

    /**
     * Get Base64 GIF synchronously if available
     */
    getBase64GIF?: () => string | undefined;

    // Any other methods
    [key: string]: any;
  }

  /**
   * Default export (CommonJS style). Consumers with "esModuleInterop"
   * can use: import gifshot from 'gifshot';
   *
   * Also allow require('gifshot').
   */
  const gifshot: GifshotStatic;
  export = gifshot;
}