import React from 'react';

export const VECTORS = {
  ArrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  Close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  Play: <path d="M8 5v14l11-7z" />,
  Pause: <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />,
  UploadCloud: (
    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  ),
  Folder: <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
  Download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  Copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  Check: <polyline points="20 6 9 17 4 12" />,
  // FIX: Новый дизайн спиннера (сегментированное кольцо)
  // Выглядит лучше при вращении animate-spin
  Spinner: (
    <>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </>
  ),
  Refresh: <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />,
  AutoContrast: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  Trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </>
  ),
  Crosshair: (
    <>
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </>
  ),
  Placeholder: (
    <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  ),
};
