'use client';

import { useServers } from '@/hooks/use-servers';
import { ServerCard } from '@/components/server/ServerCard';

export default function ServersPage() {
  const { data, isLoading, error, refetch } = useServers();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading servers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error loading servers</h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const servers = data?.servers || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Servers</h1>
          <p className="text-muted-foreground mt-1">
            {servers.length} server{servers.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/80 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Server Grid */}
      {servers.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No servers found</h2>
          <p className="text-muted-foreground mb-4">
            Create a new Minecraft server to get started.
          </p>
          <code className="bg-muted px-3 py-1 rounded text-sm">
            mcctl create myserver
          </code>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => (
            <ServerCard key={server.name} server={server} />
          ))}
        </div>
      )}
    </div>
  );
}
