const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function readResponseText(response: Response): Promise<string> {
  return response.text();
}

export async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    chunks.push(result.value);
  }

  return decoder.decode(concat(chunks));
}

export function cloneResponseWithBody(
  response: Response,
  body: BodyInit | null
): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export function isStreamingResponse(response: Response): boolean {
  return response.body !== null;
}

export function createReadableStreamFromTextChunks(
  chunks: string[],
  options: {
    delayMs?: number;
    firstChunkDelayMs?: number;
  } = {}
): ReadableStream<Uint8Array> {
  let index = 0;
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled) {
        return;
      }
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      const delayMs = index === 0
        ? options.firstChunkDelayMs ?? 0
        : options.delayMs ?? 0;
      if (delayMs > 0) {
        await wait(delayMs);
      }
      if (cancelled) {
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]!));
      index += 1;
      if (index >= chunks.length) {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    }
  });
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
