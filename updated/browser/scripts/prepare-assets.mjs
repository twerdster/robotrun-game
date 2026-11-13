import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = data => createHash('sha256').update(data).digest('hex');
const modelHash = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const modelURL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const modelPath = path.join(root, 'public/models/hand_landmarker.task');
await mkdir(path.dirname(modelPath), { recursive: true });
let model;
try { model = await readFile(modelPath); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch(modelURL, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  model = Buffer.from(await response.arrayBuffer());
  if (hash(model) !== modelHash) throw new Error('Downloaded MediaPipe model checksum mismatch.');
  await writeFile(modelPath, model);
}
if (hash(model) !== modelHash) throw new Error('MediaPipe model checksum mismatch. Remove the changed file and rerun npm run prepare:assets.');
const mediapipe = path.join(root, 'public/mediapipe');
await mkdir(mediapipe, { recursive: true });
for (const filename of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_module_internal.js','vision_wasm_module_internal.wasm']) {
  await copyFile(path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm', filename), path.join(mediapipe, filename));
}
await mkdir(path.join(root, 'public/licenses'), { recursive: true });
for (const filename of ['MEDIAPIPE-APACHE-2.0.txt','THREE-MIT.txt']) {
  await copyFile(path.join(root, 'licenses', filename), path.join(root, 'public/licenses', filename));
}
await copyFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(root, 'public/THIRD_PARTY_NOTICES.md'));
await copyFile(path.join(root, 'LICENSE'), path.join(root, 'public/LICENSE'));
console.log('Prepared local MediaPipe runtime and verified Hand Landmarker model.');
