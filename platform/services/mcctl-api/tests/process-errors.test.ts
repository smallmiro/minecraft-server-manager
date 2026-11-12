import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { installProcessErrorHandlers } from '../src/process-errors.js';

describe('installProcessErrorHandlers (#657)', () => {
  it('logs an unhandled rejection and keeps running', () => {
    const proc = new EventEmitter();
    const log = { error: vi.fn() };
    const exit = vi.fn();
    installProcessErrorHandlers(log, proc as any, exit);
    proc.emit('unhandledRejection', new Error('x'));
    expect(log.error).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it('logs an uncaught exception and exits non-zero', () => {
    const proc = new EventEmitter();
    const log = { error: vi.fn() };
    const exit = vi.fn();
    installProcessErrorHandlers(log, proc as any, exit);
    proc.emit('uncaughtException', new Error('x'));
    expect(log.error).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
