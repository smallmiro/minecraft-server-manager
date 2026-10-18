'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { BentoGrid } from '@/components/bento';
import {
  PlatformSettingsError,
  usePlatformSettings,
  useUpdatePlatformSettings,
} from '@/hooks/usePlatformSettings';
import type { PlatformSetting, RestartScope } from '@/types/platform-settings';
import { AdvancedEnvCard } from './AdvancedEnvCard';
import { LegacyEnvCard } from './LegacyEnvCard';
import { RestartRequiredDialog } from './RestartRequiredDialog';
import { RuntimeInfoCard } from './RuntimeInfoCard';
import { SaveBar } from './SaveBar';
import { SettingsGroupCard } from './SettingsGroupCard';

export interface PlatformSettingsSectionProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function PlatformSettingsSection({ onSuccess, onError }: PlatformSettingsSectionProps) {
  // Rendered for admins only (page gate); the query is enabled accordingly.
  const { data, isLoading, error, refetch } = usePlatformSettings({ enabled: true });
  const update = useUpdatePlatformSettings();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [restartScopes, setRestartScopes] = useState<RestartScope[] | null>(null);

  const settings = data?.settings ?? [];
  const byKey = new Map(settings.map((s) => [s.key, s]));

  const groupMap = new Map<string, PlatformSetting[]>();
  for (const s of settings) {
    if (s.status !== 'supported' && s.status !== 'readonly') continue;
    groupMap.set(s.group, [...(groupMap.get(s.group) ?? []), s]);
  }
  const groups = Array.from(groupMap.entries());
  const unknown = settings.filter((s) => s.status === 'unknown');
  const legacy = settings.filter((s) => s.status === 'legacy' || s.status === 'shadowed');

  const dirtyCount = Object.keys(drafts).length + removed.size;
  const pendingCount = settings.filter((s) => s.applied === false).length;

  const reset = () => {
    setDrafts({});
    setRemoved(new Set());
    setErrors({});
  };

  const handleChange = (key: string, value: string) => {
    setErrors(({ [key]: _cleared, ...rest }) => rest);
    setDrafts((prev) => {
      const { [key]: _old, ...rest } = prev;
      const original = byKey.get(key);
      // Back to the stored value (or an empty secret) is not a change.
      if (original && (original.secret ? value === '' : value === (original.value ?? ''))) return rest;
      return { ...rest, [key]: value };
    });
  };

  const handleToggleRemove = (key: string) => {
    if (!byKey.has(key)) {
      // Added-but-unsaved key: just drop the draft.
      setDrafts(({ [key]: _gone, ...rest }) => rest);
      return;
    }
    setDrafts(({ [key]: _gone, ...rest }) => rest);
    setRemoved((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    if (!data) return;
    update.mutate(
      { revision: data.revision, set: drafts, remove: Array.from(removed) },
      {
        onSuccess: (result) => {
          reset();
          onSuccess('Platform settings saved');
          const needed = result.restartScopes.filter((s) => s !== 'none');
          if (needed.length > 0) setRestartScopes(needed);
        },
        onError: (err) => {
          if (err instanceof PlatformSettingsError) {
            if (err.status === 409) {
              setConflict(true);
              return;
            }
            const fieldErrors = (err.body as { errors?: { key: string; message: string }[] } | null)?.errors;
            if (err.status === 400 && fieldErrors?.length) {
              setErrors(Object.fromEntries(fieldErrors.map((e) => [e.key, e.message])));
              onError(fieldErrors.map((e) => `${e.key}: ${e.message}`).join('; '));
              return;
            }
          }
          onError(err.message || 'Failed to save platform settings');
        },
      }
    );
  };

  const handleReload = () => {
    setConflict(false);
    reset();
    refetch();
  };

  // Load the new revision but keep the drafts, so the next save applies only the keys the admin changed.
  const handleKeepEditing = () => {
    setConflict(false);
    refetch();
  };

  if (isLoading) return <CircularProgress aria-label="Loading platform settings" />;
  if (error || !data) {
    return <Alert severity="error">{error?.message ?? 'Failed to load platform settings'}</Alert>;
  }

  return (
    <Stack spacing={2} aria-label="Platform settings">
      {(dirtyCount > 0 || pendingCount > 0) && (
        <Stack direction="row" spacing={1}>
          {dirtyCount > 0 && <Chip color="primary" label={`${dirtyCount} unsaved`} />}
          {pendingCount > 0 && <Chip color="warning" label={`${pendingCount} pending restart`} />}
        </Stack>
      )}

      <BentoGrid aria-label="Platform settings groups">
        {groups.map(([group, items]) => (
          <SettingsGroupCard
            key={group}
            title={group}
            settings={items}
            drafts={drafts}
            errors={errors}
            onChange={handleChange}
          />
        ))}
        {data.runtime.length > 0 && <RuntimeInfoCard items={data.runtime} />}
        <AdvancedEnvCard
          settings={unknown}
          existingKeys={new Set(Array.from(byKey.keys()))}
          drafts={drafts}
          errors={errors}
          removed={removed}
          onChange={handleChange}
          onToggleRemove={handleToggleRemove}
        />
        {legacy.length > 0 && (
          <LegacyEnvCard settings={legacy} removed={removed} onToggleRemove={handleToggleRemove} />
        )}
      </BentoGrid>

      <SaveBar dirtyCount={dirtyCount} saving={update.isPending} onDiscard={reset} onSave={handleSave} />

      <RestartRequiredDialog
        open={restartScopes !== null}
        scopes={restartScopes ?? []}
        onClose={() => setRestartScopes(null)}
      />

      <Dialog open={conflict} aria-labelledby="settings-conflict-title">
        <DialogTitle id="settings-conflict-title">Settings changed elsewhere</DialogTitle>
        <DialogContent>
          <DialogContentText>
            .env was modified after you loaded this page. Nothing was saved. Reload to see the current
            values and discard your edits, or keep editing to load the latest version and save only the
            keys you changed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleKeepEditing}>Keep editing</Button>
          <Button variant="contained" onClick={handleReload}>
            Reload
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
