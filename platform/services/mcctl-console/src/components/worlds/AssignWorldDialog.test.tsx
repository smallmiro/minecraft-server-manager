import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { AssignWorldDialog } from './AssignWorldDialog';

vi.mock('@/hooks/useMcctl', () => ({
  useServers: () => ({
    data: {
      servers: [
        { name: 'idle', status: 'stopped' },
        { name: 'busy', status: 'running' },
      ],
    },
    isLoading: false,
  }),
}));

describe('AssignWorldDialog', () => {
  it('lists running servers as disabled: the API refuses them (#670)', () => {
    render(
      <ThemeProvider>
        <AssignWorldDialog open worldName="w" onClose={vi.fn()} onSubmit={vi.fn()} />
      </ThemeProvider>
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /select server/i }));
    const listbox = within(screen.getByRole('listbox'));

    expect(listbox.getByRole('option', { name: 'idle' })).not.toHaveAttribute('aria-disabled', 'true');
    expect(listbox.getByRole('option', { name: /busy/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
