import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRangedFileStream } from '../lib/range-file-stream.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'mrem-stream-'));
const file = path.join(dir, 'sample.mp4');
const payload = Buffer.alloc(600_000);
for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
await writeFile(file, payload);

test('full response streams every byte', async () => {
  const stream = await createRangedFileStream(file, 0, payload.length - 1);
  const output = Buffer.from(await new Response(stream).arrayBuffer());
  assert.deepEqual(output, payload);
});

test('middle range returns exact bytes', async () => {
  const stream = await createRangedFileStream(file, 4096, 190050);
  const output = Buffer.from(await new Response(stream).arrayBuffer());
  assert.deepEqual(output, payload.subarray(4096, 190051));
});

test('one-byte range works', async () => {
  const stream = await createRangedFileStream(file, 0, 0);
  const output = Buffer.from(await new Response(stream).arrayBuffer());
  assert.equal(output.length, 1);
  assert.equal(output[0], payload[0]);
});

test('video seek cancellation does not close controller twice', async () => {
  for (let i = 0; i < 50; i++) {
    const stream = await createRangedFileStream(file, i * 1000, payload.length - 1);
    const reader = stream.getReader();
    const first = await reader.read();
    assert.equal(first.done, false);
    await reader.cancel();
  }
});

test('rejects invalid ranges', async () => {
  await assert.rejects(createRangedFileStream(file, -1, 20), RangeError);
  await assert.rejects(createRangedFileStream(file, 200, 199), RangeError);
});

test.after(async () => { await rm(dir, {recursive:true, force:true}); });
