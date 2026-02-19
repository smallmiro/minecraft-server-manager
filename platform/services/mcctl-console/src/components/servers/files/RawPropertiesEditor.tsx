'use client';

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { oneDark } from '@codemirror/theme-one-dark';
import { useFileContent, useWriteFile } from '@/hooks/use-server-files';
import { EditorStatusBar } from './EditorStatusBar';

export interface RawPropertiesEditorHandle {
  save(): void;
  isDirty(): boolean;
}

interface RawPropertiesEditorProps {
  serverName: string;
  filePath: string;
  onDirtyChange: (dirty: boolean) => void;
}

export const RawPropertiesEditor = forwardRef<RawPropertiesEditorHandle, RawPropertiesEditorProps>(
  function RawPropertiesEditor({ serverName, filePath, onDirtyChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    const [dirty, setDirty] = useState(false);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

    const { data, isLoading, error } = useFileContent(serverName, filePath);
    const writeFile = useWriteFile(serverName);

    const handleSave = useCallback(() => {
      if (!viewRef.current) return;
      const content = viewRef.current.state.doc.toString();
      writeFile.mutate(
        { path: filePath, content },
        {
          onSuccess: () => {
            setDirty(false);
            onDirtyChange(false);
          },
        },
      );
    }, [filePath, writeFile, onDirtyChange]);

    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty: () => dirty,
    }), [handleSave, dirty]);

    // Sync dirty state to parent
    useEffect(() => {
      onDirtyChange(dirty);
    }, [dirty, onDirtyChange]);

    // Initialize CodeMirror
    useEffect(() => {
      if (!editorRef.current || !data) return;

      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }

      const saveKeymap = keymap.of([
        {
          key: 'Mod-s',
          run: () => {
            setTimeout(() => {
              if (!viewRef.current) return;
              const content = viewRef.current.state.doc.toString();
              writeFile.mutate(
                { path: filePath, content },
                {
                  onSuccess: () => {
                    setDirty(false);
                    onDirtyChange(false);
                  },
                },
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
    }, [data, filePath]);

    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load file: {error.message}
        </Alert>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {writeFile.isError && (
          <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
            Failed to save: {writeFile.error.message}
          </Alert>
        )}

        {writeFile.isSuccess && !dirty && (
          <Alert severity="success" sx={{ mx: 2, mt: 1 }}>
            File saved successfully.
          </Alert>
        )}

        {data && (
          <Box ref={editorRef} sx={{ flex: 1, overflow: 'hidden' }} />
        )}

        {data && (
          <EditorStatusBar
            language="Properties"
            fileSize={data.size}
            line={cursorPos.line}
            col={cursorPos.col}
            dirty={dirty}
          />
        )}
      </Box>
    );
  },
);
