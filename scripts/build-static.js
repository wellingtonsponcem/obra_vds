import { mkdir, copyFile, readdir, cp, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'public');
const nextOut = join(root, 'frontend', '_frontend', 'out');

await mkdir(dist, { recursive: true });

// Prioridade: Next.js static export (frontend/_frontend/out)
try {
  await stat(nextOut);
  // cp recursivo do Next out para public
  await cp(nextOut, dist, { recursive: true, force: true });
  console.log('Next.js static export copied from frontend/_frontend/out to public.');
} catch {
  console.log('Next out não encontrado, tentando fallback legado...');
  // Fallback legado (removido, mas mantido para transição)
  const files = ['index.html'];
  const folders = ['css', 'js'];
  for (const file of files) {
    try { await copyFile(join(root, file), join(dist, file)); } catch {}
  }
  for (const folder of folders) {
    const sourceFolder = join(root, folder);
    const targetFolder = join(dist, folder);
    try {
      await mkdir(targetFolder, { recursive: true });
      const entries = await readdir(sourceFolder, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          await copyFile(join(sourceFolder, entry.name), join(targetFolder, entry.name));
        }
      }
    } catch {}
  }
  console.log('Fallback legado concluído (se arquivos existirem).');
}

console.log('Build static concluído.');
