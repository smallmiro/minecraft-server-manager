'use client';

import Link from 'next/link';
import { ServerSummary } from '@/types/server';
import { getStatusColor, getHealthColor, useStartServer, useStopServer } from '@/hooks/use-servers';

interface ServerCardProps {
  server: ServerSummary;
}

export function ServerCard({ server }: ServerCardProps) {
  const startServer = useStartServer();
  const stopServer = useStopServer();

  const isLoading = startServer.isPending || stopServer.isPending;
  const isRunning = server.status === 'running';
  const isStopped = server.status === 'stopped';

  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startServer.mutate(server.name);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopServer.mutate(server.name);
  };

  return (
    <Link href={`/servers/${server.name}`}>
      <div className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-shadow cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${getStatusColor(server.status)}`} />
            <h3 className="font-semibold text-lg">{server.name}</h3>
          </div>
          <span className={`text-sm font-medium ${getHealthColor(server.health)}`}>
            {server.health}
          </span>
        </div>

        {/* Server Info */}
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-4">
          <div>
            <span className="font-medium">Type:</span> {server.type}
          </div>
          <div>
            <span className="font-medium">Version:</span> {server.version}
          </div>
          <div>
            <span className="font-medium">Players:</span> {server.playerCount}/{server.maxPlayers}
          </div>
          <div>
            <span className="font-medium">Port:</span> {server.port}
          </div>
        </div>

        {/* Connection Info */}
        <div className="text-sm text-muted-foreground mb-4">
          <span className="font-medium">Connect:</span>{' '}
          <code className="bg-muted px-1 rounded text-xs">{server.hostname}:{server.port}</code>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isStopped && (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {startServer.isPending ? 'Starting...' : 'Start'}
            </button>
          )}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {stopServer.isPending ? 'Stopping...' : 'Stop'}
            </button>
          )}
          {!isRunning && !isStopped && (
            <span className="flex-1 text-center text-sm text-muted-foreground py-1.5">
              {server.status === 'starting' ? 'Starting...' :
               server.status === 'stopping' ? 'Stopping...' :
               'Status: ' + server.status}
            </span>
          )}
        </div>

        {/* Error Messages */}
        {(startServer.error || stopServer.error) && (
          <p className="mt-2 text-sm text-red-600">
            {startServer.error?.message || stopServer.error?.message}
          </p>
        )}
      </div>
    </Link>
  );
}

export default ServerCard;
