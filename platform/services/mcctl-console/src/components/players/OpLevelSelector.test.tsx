/**
 * OpLevelSelector Component Tests
 * TDD: Red → Green → Refactor
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { OpLevelSelector } from './OpLevelSelector';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('OpLevelSelector', () => {
  describe('Rendering', () => {
    it('should render all 4 level options', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} />);

      expect(screen.getByText(/Moderator/i)).toBeInTheDocument();
      expect(screen.getByText(/Gamemaster/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin/i)).toBeInTheDocument();
      expect(screen.getByText(/Owner/i)).toBeInTheDocument();
    });

    it('should render level descriptions', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} />);

      expect(screen.getByText(/Bypass spawn protection/i)).toBeInTheDocument();
      expect(screen.getByText(/Cheats, command blocks/i)).toBeInTheDocument();
      expect(screen.getByText(/Player management commands/i)).toBeInTheDocument();
      expect(screen.getByText(/Full server control/i)).toBeInTheDocument();
    });

    it('should select the provided value', () => {
      renderWithTheme(<OpLevelSelector value={3} onChange={() => {}} />);

      const radio = screen.getByLabelText(/Level 3 - Admin/i) as HTMLInputElement;
      expect(radio.checked).toBe(true);
    });

    it('should render with custom label', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} label="Select Permission Level" />);

      expect(screen.getByText(/Select Permission Level/i)).toBeInTheDocument();
    });

    it('should not render label by default', () => {
      const { container } = renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} />);

      const label = container.querySelector('.MuiFormLabel-root');
      expect(label).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onChange when level 1 is selected', () => {
      const onChange = vi.fn();
      renderWithTheme(<OpLevelSelector value={4} onChange={onChange} />);

      const radio = screen.getByLabelText(/Level 1 - Moderator/i);
      fireEvent.click(radio);

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('should call onChange when level 2 is selected', () => {
      const onChange = vi.fn();
      renderWithTheme(<OpLevelSelector value={4} onChange={onChange} />);

      const radio = screen.getByLabelText(/Level 2 - Gamemaster/i);
      fireEvent.click(radio);

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('should call onChange when level 3 is selected', () => {
      const onChange = vi.fn();
      renderWithTheme(<OpLevelSelector value={4} onChange={onChange} />);

      const radio = screen.getByLabelText(/Level 3 - Admin/i);
      fireEvent.click(radio);

      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('should call onChange when level 4 is selected', () => {
      const onChange = vi.fn();
      renderWithTheme(<OpLevelSelector value={1} onChange={onChange} />);

      const radio = screen.getByLabelText(/Level 4 - Owner/i);
      fireEvent.click(radio);

      expect(onChange).toHaveBeenCalledWith(4);
    });

    it('should not call onChange when already selected level is clicked', () => {
      const onChange = vi.fn();
      renderWithTheme(<OpLevelSelector value={4} onChange={onChange} />);

      const radio = screen.getByLabelText(/Level 4 - Owner/i);
      fireEvent.click(radio);

      // MUI RadioGroup does not call onChange for already selected value
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable all options when disabled', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} disabled />);

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).toBeDisabled();
      });
    });

    it('should not change value when disabled', () => {
      const onChange = vi.fn();
      renderWithTheme(<OpLevelSelector value={4} onChange={onChange} disabled />);

      const ownerRadio = screen.getByLabelText(/Level 4 - Owner/i) as HTMLInputElement;
      expect(ownerRadio.checked).toBe(true);

      const moderatorRadio = screen.getByLabelText(/Level 1 - Moderator/i) as HTMLInputElement;
      fireEvent.click(moderatorRadio);

      // Value should remain unchanged
      expect(ownerRadio.checked).toBe(true);
      expect(moderatorRadio.checked).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} />);

      expect(screen.getByLabelText(/Level 1 - Moderator/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Level 2 - Gamemaster/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Level 3 - Admin/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Level 4 - Owner/i)).toBeInTheDocument();
    });

    it('should have role="radiogroup"', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} />);

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();
    });
  });

  describe('Icon Display', () => {
    it('should show icons for all levels', () => {
      renderWithTheme(<OpLevelSelector value={4} onChange={() => {}} />);

      expect(screen.getByText('🛡️')).toBeInTheDocument();
      expect(screen.getByText('🎮')).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument();
      expect(screen.getByText('👑')).toBeInTheDocument();
    });
  });
});
