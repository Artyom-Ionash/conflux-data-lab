import { useCallback, useEffect, useState } from 'react';

import { FileBundle } from '../file-system/bundle';
import { createIgnoreManager } from './_scanner';
import { CONTEXT_PRESETS, type PresetKey } from './rules';

interface BundleState {
  bundle: FileBundle | null;
  filteredPaths: string[];
  detectedPreset: PresetKey;
}

/**
 * Инкапсулирует жизненный цикл проектного бандла и логику фильтрации.
 */
export function useBundleManager() {
  const [state, setState] = useState<BundleState>({
    bundle: null,
    filteredPaths: [],
    detectedPreset: 'nextjs',
  });

  // Cleanup
  useEffect(() => () => state.bundle?.dispose(), [state.bundle]);

  const handleFiles = useCallback(
    async (files: File[], customExtensions: string, customIgnore: string) => {
      const newBundle = new FileBundle(files, {
        customExtensions: customExtensions.split(',').map((s) => s.trim()),
      });

      const presetKey = newBundle.detectedPreset;
      const preset = CONTEXT_PRESETS[presetKey];

      const gitIgnoreFile = files.find((f) => f.name === '.gitignore');
      const gitIgnoreContent = gitIgnoreFile ? await gitIgnoreFile.text() : null;

      const ig = createIgnoreManager({
        gitIgnoreContent,
        ignorePatterns: [
          ...preset.hardIgnore,
          ...customIgnore
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ],
      });

      const visiblePaths = newBundle
        .getItems()
        .filter((item) => !ig.ignores(item.path))
        .map((item) => item.path);

      setState({
        bundle: newBundle,
        filteredPaths: visiblePaths,
        detectedPreset: presetKey,
      });

      return { presetKey, visiblePaths, bundle: newBundle };
    },
    []
  );

  return { ...state, handleFiles };
}
