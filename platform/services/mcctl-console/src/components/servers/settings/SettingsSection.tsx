'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SectionConfig } from './sectionConfigs';
import type { ServerConfig } from '@/ports/api/IMcctlApiClient';
import { SettingsField } from './SettingsField';

interface SettingsSectionProps {
  section: SectionConfig;
  values: ServerConfig;
  onChange: (key: string, value: unknown) => void;
}

export function SettingsSection({ section, values, onChange }: SettingsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const Icon = section.icon;
  const advancedCount = section.advancedFields.length;

  return (
    <Card sx={{ mb: 3, borderRadius: 3 }}>
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Icon sx={{ fontSize: 22, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            {section.title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {section.description}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {/* Essential Fields */}
        <Grid container spacing={2.5}>
          {section.essentialFields.map((field) => (
            <SettingsField
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={onChange}
            />
          ))}
        </Grid>

        {/* Advanced Toggle + Collapsible Content */}
        {advancedCount > 0 && (
          <>
            <Button
              fullWidth
              variant="text"
              onClick={() => setExpanded(!expanded)}
              endIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s',
                  }}
                />
              }
              sx={{
                mt: 2.5,
                justifyContent: 'flex-start',
                color: 'text.secondary',
                textTransform: 'none',
                py: 1,
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              {expanded ? 'Hide' : 'Show'} Advanced Settings ({advancedCount})
            </Button>

            <Collapse in={expanded} timeout={300}>
              <Box sx={{ pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Grid container spacing={2.5}>
                  {section.advancedFields.map((field) => (
                    <SettingsField
                      key={field.key}
                      field={field}
                      value={values[field.key]}
                      onChange={onChange}
                    />
                  ))}
                </Grid>
              </Box>
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  );
}
