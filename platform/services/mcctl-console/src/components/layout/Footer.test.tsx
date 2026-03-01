import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { Footer } from './Footer';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Footer', () => {
  it('should render footer sections', () => {
    renderWithTheme(<Footer />);

    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('should render resource links', () => {
    renderWithTheme(<Footer />);

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
  });

  it('should render documentation links', () => {
    renderWithTheme(<Footer />);

    expect(screen.getByText('CLI Commands')).toBeInTheDocument();
    expect(screen.getByText('API Reference')).toBeInTheDocument();
    expect(screen.getByText('itzg Reference')).toBeInTheDocument();
  });

  it('should render community links', () => {
    renderWithTheme(<Footer />);

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('should render Q&A support link in community section', () => {
    renderWithTheme(<Footer />);

    const qaLink = screen.getByText('Q&A / Support');
    expect(qaLink).toBeInTheDocument();
    expect(qaLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/smallmiro/minecraft-server-manager/discussions/categories/q-a'
    );
    expect(qaLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(qaLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render Ideas link in community section', () => {
    renderWithTheme(<Footer />);

    const ideasLink = screen.getByText('Ideas / Feature Requests');
    expect(ideasLink).toBeInTheDocument();
    expect(ideasLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/smallmiro/minecraft-server-manager/discussions/categories/ideas'
    );
    expect(ideasLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(ideasLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render about links', () => {
    renderWithTheme(<Footer />);

    expect(screen.getByText('License')).toBeInTheDocument();
    expect(screen.getByText('Docker Hub')).toBeInTheDocument();
  });

  it('should render copyright with current year', () => {
    renderWithTheme(<Footer />);

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${currentYear}`))).toBeInTheDocument();
  });

  it('should render external links with correct attributes', () => {
    renderWithTheme(<Footer />);

    // Multiple GitHub links exist (community section + social icon)
    const githubLinks = screen.getAllByRole('link', { name: /GitHub/i });
    expect(githubLinks.length).toBeGreaterThan(0);
    expect(githubLinks[0]).toHaveAttribute('target', '_blank');
    expect(githubLinks[0]).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render social icons', () => {
    renderWithTheme(<Footer />);

    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    expect(screen.getByLabelText('Documentation')).toBeInTheDocument();
  });
});
