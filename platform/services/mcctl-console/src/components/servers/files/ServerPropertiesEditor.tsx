'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Grid from '@mui/material/Grid';
import { useFileContent, useWriteFile } from '@/hooks/use-server-files';
import {
  serverPropertiesSchema,
  categoryConfig,
  categoryOrder,
  getPropertySchema,
  parseServerProperties,
  serializeServerProperties,
} from './serverPropertiesSchema';
import { PropertyField } from './PropertyField';
import type { PropertyCategory } from './serverPropertiesSchema';

interface ServerPropertiesEditorProps {
  serverName: string;
}

export function ServerPropertiesEditor({ serverName }: ServerPropertiesEditorProps) {
  const filePath = '/server.properties';
  const { data, isLoading, error } = useFileContent(serverName, filePath);
  const writeFile = useWriteFile(serverName);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [originalData, setOriginalData] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Parse file content into form data
  useEffect(() => {
    if (!data?.content) return;
    const parsed = parseServerProperties(data.content);
    setFormData(parsed);
    setOriginalData(parsed);
    writeFile.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const changedKeys = useMemo(() => {
    const changed: string[] = [];
    for (const key of Object.keys(formData)) {
      if (formData[key] !== originalData[key]) {
        changed.push(key);
      }
    }
    return changed;
  }, [formData, originalData]);

  const handleSave = useCallback(() => {
    if (!data?.content) return;
    const newContent = serializeServerProperties(data.content, formData);
    writeFile.mutate(
      { path: filePath, content: newContent },
      {
        onSuccess: () => {
          setOriginalData({ ...formData });
        },
      },
    );
  }, [data, formData, writeFile]);

  const handleDiscard = useCallback(() => {
    setFormData({ ...originalData });
  }, [originalData]);

  // Group schema properties by category, filtering by search
  const groupedProperties = useMemo(() => {
    const lowerSearch = searchQuery.toLowerCase();
    const groups: Record<PropertyCategory, typeof serverPropertiesSchema> = {
      gameplay: [],
      world: [],
      network: [],
      performance: [],
      advanced: [],
    };

    // Add known schema properties
    for (const schema of serverPropertiesSchema) {
      if (lowerSearch) {
        const matchesSearch =
          schema.key.toLowerCase().includes(lowerSearch) ||
          schema.label.toLowerCase().includes(lowerSearch) ||
          schema.description.toLowerCase().includes(lowerSearch);
        if (!matchesSearch) continue;
      }
      groups[schema.category].push(schema);
    }

    // Add unknown properties (not in schema) to 'advanced'
    const knownKeys = new Set(serverPropertiesSchema.map((s) => s.key));
    for (const key of Object.keys(formData)) {
      if (knownKeys.has(key)) continue;
      if (lowerSearch && !key.toLowerCase().includes(lowerSearch)) continue;
      groups.advanced.push({
        key,
        type: 'string',
        category: 'advanced',
        label: key,
        description: 'Custom property (not in standard schema)',
        defaultValue: '',
      });
    }

    return groups;
  }, [searchQuery, formData]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load server.properties: {error.message}
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Warning Banner */}
      <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mx: 2, mt: 2, mb: 1 }}>
        <Typography variant="body2">
          <strong>Warning:</strong> Changes are applied directly to the running server file.
          For persistent settings that survive server recreation, use the <strong>Options</strong> tab.
        </Typography>
      </Alert>

      {/* Search + Action Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
        <TextField
          size="small"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        <Box sx={{ flex: 1 }} />
        {changedKeys.length > 0 && (
          <Chip
            label={`${changedKeys.length} changed`}
            color="warning"
            size="small"
          />
        )}
        <Button
          size="small"
          startIcon={<UndoIcon />}
          onClick={handleDiscard}
          disabled={changedKeys.length === 0}
        >
          Discard
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={writeFile.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={changedKeys.length === 0 || writeFile.isPending}
        >
          Save
        </Button>
      </Box>

      {writeFile.isError && (
        <Alert severity="error" sx={{ mx: 2, mb: 1 }}>
          Failed to save: {writeFile.error.message}
        </Alert>
      )}

      {writeFile.isSuccess && changedKeys.length === 0 && (
        <Alert severity="success" sx={{ mx: 2, mb: 1 }}>
          File saved successfully.
        </Alert>
      )}

      {/* Category Accordions */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
        {categoryOrder.map((category) => {
          const properties = groupedProperties[category];
          if (properties.length === 0) return null;
          const config = categoryConfig[category];
          const changedInCategory = properties.filter(
            (p) => changedKeys.includes(p.key),
          ).length;

          return (
            <Accordion key={category} defaultExpanded={category !== 'advanced'} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {config.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ({properties.length})
                  </Typography>
                  {changedInCategory > 0 && (
                    <Chip label={`${changedInCategory} modified`} size="small" color="warning" variant="outlined" />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {config.description}
                </Typography>
                <Grid container spacing={2}>
                  {properties.map((schema) => {
                    const currentValue = formData[schema.key] ?? schema.defaultValue;
                    const isChanged = changedKeys.includes(schema.key);
                    return (
                      <Grid item key={schema.key} xs={12} sm={schema.type === 'boolean' ? 6 : 12}>
                        <PropertyField
                          schema={schema}
                          value={currentValue}
                          onChange={handleChange}
                          isChanged={isChanged}
                        />
                      </Grid>
                    );
                  })}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Box>
  );
}
