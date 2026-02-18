'use client';

import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';

interface FileBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function FileBreadcrumb({ path, onNavigate }: FileBreadcrumbProps) {
  const segments = path.split('/').filter(Boolean);

  return (
    <Breadcrumbs sx={{ mb: 1 }}>
      <Link
        component="button"
        underline="hover"
        color="inherit"
        onClick={() => onNavigate('/')}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
      >
        <HomeIcon sx={{ fontSize: 18 }} />
        root
      </Link>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const segmentPath = '/' + segments.slice(0, index + 1).join('/');

        if (isLast) {
          return (
            <Typography key={segmentPath} color="text.primary" sx={{ fontWeight: 500 }}>
              {segment}
            </Typography>
          );
        }

        return (
          <Link
            key={segmentPath}
            component="button"
            underline="hover"
            color="inherit"
            onClick={() => onNavigate(segmentPath)}
            sx={{ cursor: 'pointer' }}
          >
            {segment}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
