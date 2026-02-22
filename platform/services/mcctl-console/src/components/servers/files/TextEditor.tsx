'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DescriptionIcon from '@mui/icons-material/Description';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { useFileContent, useWriteFile } from '@/hooks/use-server-files';
import { EditorStatusBar } from './EditorStatusBar';

const MAX_EDITABLE_SIZE = 5 * 1024 * 1024; // 5MB

interface TextEditorProps {
  serverName: string;
  filePath: string;
  onBack: () => void;
}

function getLanguageName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    json: 'JSON',
    yml: 'YAML',
    yaml: 'YAML',
    xml: 'XML',
    html: 'HTML',
    properties: 'Properties',
    toml: 'TOML',
    cfg: 'Config',
    conf: 'Config',
    ini: 'INI',
    txt: 'Plain Text',
    md: 'Markdown',
    log: 'Log',
    sh: 'Shell',
    bat: 'Batch',
    csv: 'CSV',
  };
  return map[ext] || 'Plain Text';
}

function getLanguageExtension(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'json':
      return json();
    case 'yml':
    case 'yaml':
      return yaml();
    case 'xml':
    case 'html':
      return xml();
    default:
      return [];
  }
}

export function TextEditor({ serverName, filePath, onBack }: TextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const [dirty, setDirty] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [backRequested, setBackRequested] = useState(false);

  const fileName = filePath.split('/').pop() || '';
  const { data, isLoading, error } = useFileContent(serverName, filePath);
  const writeFile = useWriteFile(serverName);

  // Save handler
  const handleSave = useCallback(() => {
    if (!viewRef.current || !filePath) return;
    const content = viewRef.current.state.doc.toString();
    writeFile.mutate(
      { path: filePath, content },
      {
        onSuccess: () => setDirty(false),
      },
    );
  }, [filePath, writeFile]);

  // Back with unsaved check
  const handleBack = useCallback(() => {
    if (dirty) {
      setBackRequested(true);
    } else {
      onBack();
    }
  }, [dirty, onBack]);

  const handleDiscardAndBack = useCallback(() => {
    setBackRequested(false);
    setDirty(false);
    onBack();
  }, [onBack]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || !data) return;

    // Cleanup previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          setTimeout(() => {
            if (!viewRef.current || !filePath) return;
            const content = viewRef.current.state.doc.toString();
            writeFile.mutate(
              { path: filePath, content },
              { onSuccess: () => setDirty(false) },
            );
          }, 0);
          return true;
        },
        preventDefault: true,
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setDirty(true);
      }
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursorPos({ line: line.number, col: pos - line.from + 1 });
      }
    });

    const state = EditorState.create({
      doc: data.content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        getLanguageExtension(fileName),
        saveKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        updateListener,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace' },
          '.cm-gutters': { fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace' },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, fileName, filePath]);

  const isTooLarge = data && data.size > MAX_EDITABLE_SIZE;

  return (
    <>
      <Card sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <IconButton size="small" onClick={handleBack} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <DescriptionIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {fileName}
            {dirty && ' *'}
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={writeFile.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!dirty || writeFile.isPending}
          >
            Save
          </Button>
        </Box>

        {/* Content */}
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 0, '&:last-child': { pb: 0 } }}>
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              Failed to load file: {error.message}
            </Alert>
          )}

          {isTooLarge && (
            <Alert severity="warning" sx={{ m: 2 }}>
              This file is too large to edit ({(data.size / 1024 / 1024).toFixed(1)} MB).
              Maximum editable size is 5 MB.
            </Alert>
          )}

          {writeFile.isError && (
            <Alert severity="error" sx={{ m: 2 }}>
              Failed to save: {writeFile.error.message}
            </Alert>
          )}

          {writeFile.isSuccess && !dirty && (
            <Alert severity="success" sx={{ m: 2 }}>
              File saved successfully.
            </Alert>
          )}

          {data && !isTooLarge && (
            <Box ref={editorRef} sx={{ flex: 1, overflow: 'hidden' }} />
          )}

          {data && !isTooLarge && (
            <EditorStatusBar
              language={getLanguageName(fileName)}
              fileSize={data.size}
              line={cursorPos.line}
              col={cursorPos.col}
              dirty={dirty}
            />
          )}
        </CardContent>
      </Card>

      {/* Unsaved Changes Confirmation */}
      <Dialog open={backRequested} onClose={() => setBackRequested(false)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Unsaved Changes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You have unsaved changes in <strong>{fileName}</strong>. Do you want to discard them?
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setBackRequested(false)}>Cancel</Button>
            <Button onClick={handleDiscardAndBack} color="error" variant="contained">
              Discard
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
