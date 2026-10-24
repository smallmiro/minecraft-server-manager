import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HostnameSection } from './HostnameSection';
import * as mcctl from '@/hooks/useMcctl';
import * as playit from '@/hooks/usePlayit';

vi.mock('@/hooks/useMcctl');
vi.mock('@/hooks/usePlayit');

describe('HostnameSection', () => {
  let queryClient: QueryClient;
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    mutateAsync.mockResolvedValue({ success: true });
    vi.mocked(mcctl.useServerHostnames).mockReturnValue({
      data: { systemHostnames: [], customHostnames: ['a.playit.gg', 'b.example.com'] },
      isLoading: false,
    } as any);
    vi.mocked(mcctl.useUpdateHostnames).mockReturnValue({ mutateAsync, isPending: false } as any);
    vi.mocked(playit.usePlayitStatus).mockReturnValue({
      data: { servers: [{ serverName: 'survival', playitDomain: 'a.playit.gg' }] },
    } as any);
  });

  const renderIt = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <HostnameSection serverName="survival" />
      </QueryClientProvider>
    );

  it('keeps the #hostnames anchor while loading, so the Routing deep link has a target', () => {
    vi.mocked(mcctl.useServerHostnames).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = renderIt();
    expect(container.querySelector('#hostnames')).not.toBeNull();
  });

  it('marks only the playit domain with a chip', () => {
    renderIt();
    expect(screen.getAllByText('playit')).toHaveLength(1);
  });

  it('after save tells to stop then start, and refreshes playit status', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderIt();
    fireEvent.click(screen.getAllByTitle('Remove domain')[1]);
    fireEvent.click(screen.getByText('Save Hostnames'));
    await waitFor(() => expect(screen.getAllByText(/stop the server, then start it again/i).length).toBeTruthy());
    expect(screen.getAllByText(/does not apply/i).length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['playit-status'] });
  });
});
