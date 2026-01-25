'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useServer,
  useServerLogs,
  useStartServer,
  useStopServer,
  useRestartServer,
  getStatusColor,
  getHealthColor,
} from '@/hooks/use-servers';

type TabType = 'overview' | 'players' | 'console' | 'config';

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverName = params.name as string;
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data: server, isLoading, error, refetch } = useServer(serverName);
  const { data: logsData, refetch: refetchLogs } = useServerLogs(serverName, 100);

  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();

  const isActionLoading =
    startServer.isPending || stopServer.isPending || restartServer.isPending;
  const isRunning = server?.status === 'running';
  const isStopped = server?.status === 'stopped';

  const handleStart = () => {
    startServer.mutate(serverName);
  };

  const handleStop = () => {
    stopServer.mutate(serverName);
  };

  const handleRestart = () => {
    restartServer.mutate(serverName);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading server details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">
            Error loading server
          </h2>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => router.back()}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/80 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => refetch()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Server not found</h2>
          <p className="text-muted-foreground mb-4">
            The server &quot;{serverName}&quot; does not exist.
          </p>
          <Link
            href="/servers"
            className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors inline-block"
          >
            View All Servers
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'players', label: `Players (${server.players.online}/${server.players.max})` },
    { id: 'console', label: 'Console' },
    { id: 'config', label: 'Config' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/servers"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-3">
            <span className={`w-4 h-4 rounded-full ${getStatusColor(server.status)}`} />
            <h1 className="text-2xl font-bold">{server.name}</h1>
            <span className={`text-sm font-medium ${getHealthColor(server.health)}`}>
              {server.health}
            </span>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/80 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server Info */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Server Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-medium">{server.type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>
                <span className="ml-2 font-medium">{server.version}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Memory:</span>
                <span className="ml-2 font-medium">
                  {server.memory.used || '-'} / {server.memory.allocated}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Uptime:</span>
                <span className="ml-2 font-medium">{server.uptime || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Hostname:</span>
                <code className="ml-2 bg-muted px-2 py-0.5 rounded text-sm">
                  {server.hostname}:{server.port}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground">Players:</span>
                <span className="ml-2 font-medium">
                  {server.players.online}/{server.players.max}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Controls</h2>
            <div className="flex flex-col gap-3">
              {isStopped && (
                <button
                  onClick={handleStart}
                  disabled={isActionLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {startServer.isPending ? 'Starting...' : '▶ Start'}
                </button>
              )}
              {isRunning && (
                <>
                  <button
                    onClick={handleStop}
                    disabled={isActionLoading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {stopServer.isPending ? 'Stopping...' : '⏹ Stop'}
                  </button>
                  <button
                    onClick={handleRestart}
                    disabled={isActionLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {restartServer.isPending ? 'Restarting...' : '🔄 Restart'}
                  </button>
                </>
              )}
              {!isRunning && !isStopped && (
                <span className="text-center text-muted-foreground py-2">
                  {server.status === 'starting'
                    ? 'Starting...'
                    : server.status === 'stopping'
                    ? 'Stopping...'
                    : `Status: ${server.status}`}
                </span>
              )}
            </div>

            {/* Error Messages */}
            {(startServer.error || stopServer.error || restartServer.error) && (
              <p className="mt-4 text-sm text-red-600">
                {startServer.error?.message ||
                  stopServer.error?.message ||
                  restartServer.error?.message}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            Online Players ({server.players.online}/{server.players.max})
          </h2>
          {server.players.list.length === 0 ? (
            <p className="text-muted-foreground">No players online</p>
          ) : (
            <div className="space-y-2">
              {server.players.list.map((player) => (
                <div
                  key={player.uuid}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://mc-heads.net/avatar/${player.uuid}/32`}
                      alt={player.name}
                      className="w-8 h-8 rounded"
                    />
                    <span className="font-medium">{player.name}</span>
                    {player.joinedAt && (
                      <span className="text-sm text-muted-foreground">
                        Joined: {new Date(player.joinedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="text-sm px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">
                      Kick
                    </button>
                    <button className="text-sm px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                      Ban
                    </button>
                    <button className="text-sm px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors">
                      OP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'console' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Console</h2>
            <button
              onClick={() => refetchLogs()}
              className="text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded hover:bg-secondary/80 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="h-96 overflow-y-auto bg-black text-green-400 font-mono text-sm p-4">
            {logsData?.lines.map((line, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {line}
              </div>
            )) || <p className="text-gray-500">No logs available</p>}
          </div>
          <div className="p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // TODO: Implement RCON command execution
                alert('RCON command execution not yet implemented');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Enter command..."
                className="flex-1 px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={!isRunning}
              />
              <button
                type="submit"
                disabled={!isRunning}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Server Configuration</h2>
          <p className="text-muted-foreground">
            Server configuration editing is not yet implemented.
          </p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <pre className="text-sm">
              {JSON.stringify(
                {
                  name: server.name,
                  type: server.type,
                  version: server.version,
                  memory: server.memory.allocated,
                  port: server.port,
                  hostname: server.hostname,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
