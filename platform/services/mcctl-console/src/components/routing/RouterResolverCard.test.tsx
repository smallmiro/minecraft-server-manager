import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { RouterResolverCard } from './RouterResolverCard';
import type { AvahiInfo, RouterResolver } from '@/ports/api/IMcctlApiClient';

const resolver: RouterResolver = { hostIp: '192.168.1.5', hostIps: ['192.168.1.5', '10.0.0.7'] };
const avahi: AvahiInfo = { name: 'avahi-daemon', status: 'running', type: 'system' };

const renderCard = (props: { resolver?: RouterResolver; avahi?: AvahiInfo; serverName?: string } = {}) =>
  render(
    <ThemeProvider>
      <RouterResolverCard {...props} />
    </ThemeProvider>
  );

describe('RouterResolverCard', () => {
  it('renders a heading', () => {
    renderCard({ resolver, avahi });
    expect(screen.getByRole('heading', { name: 'Hostname Resolver' })).toBeInTheDocument();
  });

  it('lists every host IP and marks the primary one', () => {
    renderCard({ resolver, avahi });
    const list = screen.getByRole('list', { name: 'Host IPs' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('192.168.1.5')).toBeInTheDocument();
    expect(within(items[0]).getByText('Primary')).toBeInTheDocument();
    expect(within(items[1]).getByText('10.0.0.7')).toBeInTheDocument();
    expect(within(items[1]).queryByText('Primary')).not.toBeInTheDocument();
  });

  it('shows a nip.io example for the given server with a copy button', () => {
    renderCard({ resolver, avahi, serverName: 'survival' });
    expect(screen.getByText('survival.192.168.1.5.nip.io')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
  });

  it('falls back to a <server> placeholder when there are no routes', () => {
    renderCard({ resolver, avahi });
    expect(screen.getByText('<server>.192.168.1.5.nip.io')).toBeInTheDocument();
  });

  it('hints that HOST_IP is not configured when the resolver is missing', () => {
    renderCard({ avahi });
    expect(screen.getByText(/HOST_IP not configured/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Host IPs' })).not.toBeInTheDocument();
    expect(screen.queryByText(/nip\.io$/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Copy to clipboard')).not.toBeInTheDocument();
  });

  it('hints that HOST_IP is not configured when there is no primary host IP', () => {
    renderCard({ resolver: { hostIps: [] }, avahi });
    expect(screen.getByText(/HOST_IP not configured/i)).toBeInTheDocument();
  });

  it('shows the Avahi status chip with the matching color', () => {
    renderCard({ resolver, avahi });
    expect(screen.getByLabelText('Avahi status')).toHaveTextContent('running');
    expect(screen.getByLabelText('Avahi status')).toHaveClass('MuiChip-colorSuccess');
  });

  it.each([
    ['not running', 'MuiChip-colorWarning'],
    ['not installed', 'MuiChip-colorError'],
    ['something else', 'MuiChip-colorDefault'],
  ])('maps Avahi status "%s" to %s', (status, cls) => {
    renderCard({ resolver, avahi: { ...avahi, status } });
    expect(screen.getByLabelText('Avahi status')).toHaveClass(cls);
  });

  it('shows unknown when Avahi data is missing', () => {
    renderCard({ resolver });
    expect(screen.getByLabelText('Avahi status')).toHaveTextContent('unknown');
  });
});
