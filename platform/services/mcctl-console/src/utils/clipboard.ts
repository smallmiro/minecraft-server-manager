/**
 * Copy text to the clipboard. Works in insecure contexts (plain HTTP on a LAN IP)
 * where navigator.clipboard is undefined, via a hidden textarea + execCommand.
 * Resolves false when copying failed.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  // Inside a focus-trapping modal (MUI Popover/Dialog) the textarea must live in the
  // trap, otherwise the trap steals focus back and execCommand('copy') fails.
  const host = document.activeElement?.closest('[role=presentation],[role=dialog]') ?? document.body;
  host.appendChild(ta);
  try {
    ta.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}
