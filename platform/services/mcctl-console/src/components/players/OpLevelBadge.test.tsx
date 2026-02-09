/**
 * OpLevelBadge Component Tests
 * TDD: Red → Green → Refactor
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { OpLevelBadge } from './OpLevelBadge';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('OpLevelBadge', () => {
  describe('Level Display', () => {
    it('should render Level 1 Moderator badge with info color', () => {
      renderWithTheme(<OpLevelBadge level={1} />);

      expect(screen.getByText(/Level 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Moderator/i)).toBeInTheDocument();
    });

    it('should render Level 2 Gamemaster badge with success color', () => {
      renderWithTheme(<OpLevelBadge level={2} />);

      expect(screen.getByText(/Level 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Gamemaster/i)).toBeInTheDocument();
    });

    it('should render Level 3 Admin badge with warning color', () => {
      renderWithTheme(<OpLevelBadge level={3} />);

      expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin/i)).toBeInTheDocument();
    });

    it('should render Level 4 Owner badge with error color', () => {
      renderWithTheme(<OpLevelBadge level={4} />);

      expect(screen.getByText(/Level 4/i)).toBeInTheDocument();
      expect(screen.getByText(/Owner/i)).toBeInTheDocument();
    });

    it('should show icon for Level 1', () => {
      renderWithTheme(<OpLevelBadge level={1} showIcon />);

      expect(screen.getByText('🛡️')).toBeInTheDocument();
    });

    it('should show icon for Level 2', () => {
      renderWithTheme(<OpLevelBadge level={2} showIcon />);

      expect(screen.getByText('🎮')).toBeInTheDocument();
    });

    it('should show icon for Level 3', () => {
      renderWithTheme(<OpLevelBadge level={3} showIcon />);

      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });

    it('should show icon for Level 4', () => {
      renderWithTheme(<OpLevelBadge level={4} showIcon />);

      expect(screen.getByText('👑')).toBeInTheDocument();
    });

    it('should not show icon by default', () => {
      renderWithTheme(<OpLevelBadge level={1} />);

      expect(screen.queryByText('🛡️')).not.toBeInTheDocument();
    });

    it('should render with small size', () => {
      const { container } = renderWithTheme(<OpLevelBadge level={1} size="small" />);

      const chip = container.querySelector('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-sizeSmall');
    });

    it('should render with medium size by default', () => {
      const { container } = renderWithTheme(<OpLevelBadge level={1} />);

      const chip = container.querySelector('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-sizeMedium');
    });
  });

  describe('Compact Mode', () => {
    it('should render compact mode with only level number', () => {
      renderWithTheme(<OpLevelBadge level={4} compact />);

      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.queryByText(/Owner/i)).not.toBeInTheDocument();
    });

    it('should render compact mode with icon', () => {
      renderWithTheme(<OpLevelBadge level={4} compact showIcon />);

      expect(screen.getByText('👑')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.queryByText(/Owner/i)).not.toBeInTheDocument();
    });
  });

  describe('Variant Prop', () => {
    it('should render filled variant by default', () => {
      const { container } = renderWithTheme(<OpLevelBadge level={1} />);

      const chip = container.querySelector('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-filled');
    });

    it('should render outlined variant', () => {
      const { container } = renderWithTheme(<OpLevelBadge level={1} variant="outlined" />);

      const chip = container.querySelector('.MuiChip-root');
      expect(chip).toHaveClass('MuiChip-outlined');
    });
  });
});
