"use client";

import React from "react";

interface FileInputProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileInput({ onChange }: FileInputProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Видео файл
      </label>
      <input
        type="file"
        accept="video/*"
        onChange={onChange}
        className="block w-full text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 dark:text-zinc-100"
      />
    </div>
  );
}


