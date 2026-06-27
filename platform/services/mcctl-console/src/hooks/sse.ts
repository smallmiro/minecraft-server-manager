/**
 * Consume a `text/event-stream` response body, parsing SSE frames and invoking
 * {@link onEvent} per frame with the event name and JSON-parsed data. Shared by
 * the POST-driven SSE hooks (render, analyze) so the frame parsing lives in one
 * place. Frames with no `data:` line, or unparseable JSON, are skipped.
 */
export async function consumeSseStream(
  response: Response,
  onEvent: (event: string, payload: unknown) => void
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (frame: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    onEvent(event, payload);
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      handleFrame(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
    }
  }
  if (buffer.trim()) handleFrame(buffer);
}
