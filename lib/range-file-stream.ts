import { open } from 'node:fs/promises';

/**
 * Read only the requested byte range from a local file.
 * Handles browser cancellation (video seek, pause, close) without closing a
 * ReadableStream controller twice or leaking file descriptors.
 */
export async function createRangedFileStream(filePath: string, start: number, end: number): Promise<ReadableStream<Uint8Array>> {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new RangeError('Invalid file byte range');
  }

  const file = await open(filePath, 'r');
  let position = start;
  let cancelled = false;
  let finished = false;
  let closePromise: Promise<void> | undefined;
  const closeFile = () => (closePromise ??= file.close().catch(() => {}));

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (cancelled || finished) return;
      const length = Math.min(128 * 1024, end - position + 1);
      if (length <= 0) {
        finished = true;
        controller.close();
        await closeFile();
        return;
      }
      const bytes = new Uint8Array(length);
      try {
        const result = await file.read(bytes, 0, length, position);
        // The browser may cancel a video request while a filesystem read is pending.
        if (cancelled || finished) return;
        if (result.bytesRead === 0) {
          finished = true;
          controller.error(new Error('File ended before the requested byte range completed'));
          return;
        }
        position += result.bytesRead;
        controller.enqueue(bytes.subarray(0, result.bytesRead));
        if (position > end) {
          finished = true;
          controller.close();
        }
      } catch (error) {
        if (!cancelled && !finished) {
          finished = true;
          controller.error(error);
        }
      } finally {
        if (cancelled || finished) await closeFile();
      }
    },
    async cancel() {
      cancelled = true;
      await closeFile();
    },
  }, { highWaterMark: 1 });
}
