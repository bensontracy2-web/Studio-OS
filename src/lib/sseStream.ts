export interface SseStreamCallbacks<TDone> {
  onChunk: (delta: string) => void;
  onDone: (payload: TDone) => void;
}

export async function consumeSsePost<TDone extends Record<string, unknown>>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  callbacks: SseStreamCallbacks<TDone>
): Promise<TDone> {
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let errMsg = `Request failed (${resp.status})`;
    let errCode: string | undefined;
    try {
      const errJson = (await resp.json()) as { error?: string; code?: string };
      if (errJson?.error) errMsg = errJson.error;
      if (errJson?.code) errCode = errJson.code;
    } catch {
      // ignore non-JSON error
    }
    const err = new Error(errMsg) as Error & { code?: string };
    err.code = errCode;
    throw err;
  }

  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !resp.body) {
    const json = (await resp.json()) as TDone;
    callbacks.onDone(json);
    return json;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: TDone | null = null;

  const processEventBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const rawJson = line.slice(5).trim();
      if (!rawJson) continue;
      const parsed = JSON.parse(rawJson) as
        | { type: "chunk"; delta?: string }
        | { type: "error"; error?: string; code?: string }
        | ({ type: "done" } & TDone);

      if (parsed.type === "chunk" && typeof parsed.delta === "string") {
        callbacks.onChunk(parsed.delta);
      } else if (parsed.type === "error") {
        const err = new Error(parsed.error || "Streaming AI request failed.") as Error & {
          code?: string;
        };
        err.code = parsed.code;
        throw err;
      } else if (parsed.type === "done") {
        donePayload = parsed;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }

    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (part.trim()) {
        processEventBlock(part);
      }
    }

    if (done) {
      if (buffer.trim()) {
        processEventBlock(buffer);
      }
      break;
    }
  }

  if (!donePayload) {
    throw new Error("Stream ended before completion.");
  }

  callbacks.onDone(donePayload);
  return donePayload;
}
