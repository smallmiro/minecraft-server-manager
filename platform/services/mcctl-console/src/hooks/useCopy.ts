'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/utils/clipboard';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/** Copy helper exposing a transient status so the UI can show success/failure. */
export function useCopy(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      setStatus(ok ? 'copied' : 'failed');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus('idle'), resetMs);
      return ok;
    },
    [resetMs]
  );

  return { status, copy };
}
