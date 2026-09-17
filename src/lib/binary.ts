import type { Bytes } from "@/types/pixels";

const CHUNK_SIZE = 0x8000;

/** Chunked because `String.fromCharCode(...huge)` blows the call stack. */
export function toBase64(bytes: Bytes): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Bytes {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Native CompressionStream: no dependency, and pixel art deflates roughly 20–50×, which is
 * what keeps a JSON backup of a whole library a sane size.
 *
 * Driven through the raw streams rather than `new Blob(...).stream()` — jsdom's Blob has no
 * `.stream()`, and this way the codec is identical in the browser and under test.
 */
export async function deflate(bytes: Bytes): Promise<Bytes> {
  return pipeThrough(bytes, new CompressionStream("deflate-raw"));
}

export async function inflate(bytes: Bytes): Promise<Bytes> {
  return pipeThrough(bytes, new DecompressionStream("deflate-raw"));
}

async function pipeThrough(
  bytes: Bytes,
  transform: CompressionStream | DecompressionStream,
): Promise<Bytes> {
  const writer = transform.writable.getWriter();
  // Deliberately not awaited: the reader below drains the stream that these fill.
  void writer.write(bytes);
  void writer.close();

  return collect(transform.readable as ReadableStream<Bytes>);
}

async function collect(stream: ReadableStream<Bytes>): Promise<Bytes> {
  const reader = stream.getReader();
  const chunks: Bytes[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
