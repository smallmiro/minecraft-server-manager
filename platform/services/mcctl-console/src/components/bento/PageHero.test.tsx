import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme';
import { PageHero } from './PageHero';

const renderHero = (compact = false) =>
  render(
    <ThemeProvider>
      <PageHero
        title="Servers"
        eyebrow="Operations"
        description="Manage Minecraft servers"
        status={<span>Live</span>}
        actions={<button type="button">Create server</button>}
        compact={compact}
      >
        <span>3 running</span>
      </PageHero>
    </ThemeProvider>,
  );

describe('PageHero', () => {
  it('renders one level-one heading with status and actions in DOM order', () => {
    renderHero();

    const heading = screen.getByRole('heading', { level: 1, name: 'Servers' });
    const status = screen.getByText('Live');
    const action = screen.getByRole('button', { name: 'Create server' });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(status.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses compact spacing without dropping content', () => {
    renderHero(true);

    const hero = screen.getByTestId('page-hero');
    expect(hero).toHaveAttribute('data-compact', 'true');
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Manage Minecraft servers')).toBeInTheDocument();
    expect(screen.getByText('3 running')).toBeInTheDocument();
  });
});
