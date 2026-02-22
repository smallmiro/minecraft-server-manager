import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { HostnameDisplay } from './HostnameDisplay';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('HostnameDisplay', () => {
  describe('no hostname', () => {
    it('should render dash when hostname is undefined', () => {
      renderWithTheme(<HostnameDisplay />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should render dash when hostname is empty string', () => {
      renderWithTheme(<HostnameDisplay hostname="" />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('single hostname', () => {
    it('should render hostname text', () => {
      renderWithTheme(<HostnameDisplay hostname="server.local" />);
      expect(screen.getByText('server.local')).toBeInTheDocument();
    });

    it('should not show copy button by default', () => {
      renderWithTheme(<HostnameDisplay hostname="server.local" />);
      expect(screen.queryByLabelText('Copy to clipboard')).not.toBeInTheDocument();
    });

    it('should show copy button when showCopyButton is true', () => {
      renderWithTheme(<HostnameDisplay hostname="server.local" showCopyButton />);
      expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
    });

    it('should append port suffix', () => {
      renderWithTheme(<HostnameDisplay hostname="server.local" portSuffix={25565} />);
      expect(screen.getByText('server.local:25565')).toBeInTheDocument();
    });
  });

  describe('multiple hostnames', () => {
    const multiHostname = 'server.local,server.192.168.1.1.nip.io,server.100.1.2.3.nip.io';

    it('should render primary hostname (.local preferred)', () => {
      renderWithTheme(<HostnameDisplay hostname={multiHostname} />);
      expect(screen.getByText('server.local')).toBeInTheDocument();
    });

    it('should render +N chip for additional hostnames', () => {
      renderWithTheme(<HostnameDisplay hostname={multiHostname} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('should show popover with all hostnames on chip click', () => {
      renderWithTheme(<HostnameDisplay hostname={multiHostname} />);

      const chip = screen.getByText('+2');
      fireEvent.click(chip);

      // All hostnames should be visible in popover
      expect(screen.getByText('server.192.168.1.1.nip.io')).toBeInTheDocument();
      expect(screen.getByText('server.100.1.2.3.nip.io')).toBeInTheDocument();
    });

    it('should append port suffix to all hostnames in popover', () => {
      renderWithTheme(<HostnameDisplay hostname={multiHostname} portSuffix={25565} />);

      expect(screen.getByText('server.local:25565')).toBeInTheDocument();

      const chip = screen.getByText('+2');
      fireEvent.click(chip);

      expect(screen.getByText('server.192.168.1.1.nip.io:25565')).toBeInTheDocument();
      expect(screen.getByText('server.100.1.2.3.nip.io:25565')).toBeInTheDocument();
    });

    it('should show copy button for each hostname in popover', () => {
      renderWithTheme(<HostnameDisplay hostname={multiHostname} />);

      const chip = screen.getByText('+2');
      fireEvent.click(chip);

      const copyButtons = screen.getAllByLabelText('Copy to clipboard');
      expect(copyButtons).toHaveLength(3);
    });

    it('should not propagate chip click to parent', () => {
      const parentClick = vi.fn();
      render(
        <ThemeProvider>
          <div onClick={parentClick}>
            <HostnameDisplay hostname={multiHostname} />
          </div>
        </ThemeProvider>
      );

      const chip = screen.getByText('+2');
      fireEvent.click(chip);

      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('copy functionality', () => {
    it('should copy text to clipboard on copy button click', async () => {
      renderWithTheme(<HostnameDisplay hostname="server.local" showCopyButton />);

      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('server.local');
    });

    it('should copy hostname with port suffix', async () => {
      renderWithTheme(
        <HostnameDisplay hostname="server.local" portSuffix={25565} showCopyButton />
      );

      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('server.local:25565');
    });

    it('should not propagate copy click to parent', () => {
      const parentClick = vi.fn();
      render(
        <ThemeProvider>
          <div onClick={parentClick}>
            <HostnameDisplay hostname="server.local" showCopyButton />
          </div>
        </ThemeProvider>
      );

      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('two hostnames', () => {
    it('should show +1 chip', () => {
      renderWithTheme(<HostnameDisplay hostname="a.local,b.nip.io" />);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });
});
