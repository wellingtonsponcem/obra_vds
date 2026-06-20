import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const files = ['index.html'];
const folders = ['css', 'js'];

await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(dist, file));
}

for (const folder of folders) {
  const sourceFolder = join(root, folder);
  const targetFolder = join(dist, folder);
  await mkdir(targetFolder, { recursive: true });

  const entries = await readdir(sourceFolder, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      await copyFile(join(sourceFolder, entry.name), join(targetFolder, entry.name));
    }
  }
}

console.log('Static files copied to dist.');
