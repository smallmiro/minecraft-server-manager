/**
 * Server Creation Hook with SSE Progress
 * Real-time progress updates during server creation
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';
import type { ServerCreateEvent } from '@/types/events';

/**
 * Server creation status
 */
export type CreateServerStatus =
  | 'idle'
  | 'initializing'
  | 'creating'
  | 'configuring'
  | 'starting'
  | 'completed'
  | 'error';

/**
 * Options for useCreateServerSSE hook
 */
export interface UseCreateServerSSEOptions {
  /**
   * Callback when server creation succeeds
   */
  onSuccess?: (serverName: string) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: string) => void;

  /**
   * Callback for each progress update
   */
  onProgress?: (status: CreateServerStatus, message: string, progress: number) => void;
}

/**
 * Return type for useCreateServerSSE hook
 */
export interface UseCreateServerSSEReturn {
  /**
   * Current status of server creation
   */
  status: CreateServerStatus;

  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Current status message
   */
  message: string;

  /**
   * Error message if status is 'error'
   */
  error: string | null;

  /**
   * Whether server creation is in progress
   */
  isCreating: boolean;

  /**
   * Start server creation with SSE progress
   */
  createServer: (data: CreateServerRequest) => void;

  /**
   * Reset state to idle
   */
  reset: () => void;
}

/**
 * Hook for creating a server with real-time SSE progress updates
 *
 * @example
 * ```tsx
 * const { status, progress, message, createServer } = useCreateServerSSE({
 *   onSuccess: (name) => console.log('Created:', name),
 *   onError: (err) => console.error('Error:', err),
 * });
 *
 * // Start creation
 * createServer({
 *   name: 'my-server',
 *   type: 'PAPER',
 *   version: '1.21.1',
 *   memory: '4G',
 * });
 * ```
 */
export function useCreateServerSSE(
  options: UseCreateServerSSEOptions = {}
): UseCreateServerSSEReturn {
  const { onSuccess, onError, onProgress } = options;

  const [status, setStatus] = useState<CreateServerStatus>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Store EventSource to cleanup on unmount
  const eventSourceRef = useRef<EventSource | null>(null);
  const serverNameRef = useRef<string>('');

  /**
   * Reset state to idle
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setError(null);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /**
   * Update status and progress
   */
  const updateProgress = useCallback(
    (newStatus: CreateServerStatus, newMessage: string, newProgress: number) => {
      setStatus(newStatus);
      setMessage(newMessage);
      setProgress(newProgress);
      onProgress?.(newStatus, newMessage, newProgress);
    },
    [onProgress]
  );

  /**
   * Start server creation with SSE
   */
  const createServer = useCallback(
    async (data: CreateServerRequest) => {
      // Prevent multiple simultaneous creations
      if (status !== 'idle' && status !== 'completed' && status !== 'error') {
        return;
      }

      // Reset previous state
      setError(null);
      updateProgress('initializing', 'Initializing server creation...', 0);
      serverNameRef.current = data.name;

      // Close any existing EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        // Use regular REST API for now since backend doesn't support SSE for POST yet
        // When backend adds SSE support, we'll handle the ReadableStream here
        const response = await fetch('/api/servers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Server creation failed: ${response.statusText}`);
        }

        const result = await response.json();

        // Simulate progress updates for better UX
        // TODO: Replace with real SSE progress when backend supports it
        updateProgress('creating', 'Creating server configuration...', 25);

        await new Promise((resolve) => setTimeout(resolve, 500));
        updateProgress('configuring', 'Configuring Docker compose...', 50);

        await new Promise((resolve) => setTimeout(resolve, 500));
        updateProgress('starting', 'Starting server container...', 75);

        await new Promise((resolve) => setTimeout(resolve, 500));

        updateProgress('completed', 'Server created successfully!', 100);
        onSuccess?.(data.name);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setStatus('error');
        setError(errorMessage);
        setMessage('Server creation failed');
        onError?.(errorMessage);
      }
    },
    [status, updateProgress, onSuccess, onError]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return {
    status,
    progress,
    message,
    error,
    isCreating: status !== 'idle' && status !== 'completed' && status !== 'error',
    createServer,
    reset,
  };
}
