import { cp, mkdir, readdir, lstat, copyFile, readlink } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('out');
const repoBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.BASE_PATH ??
  (process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}` : '');

const sanitizedBasePath = repoBasePath?.replace(/^\/+/, '').replace(/\/+$/, '') ?? '';

if (!sanitizedBasePath) {
  console.log('No basePath detected, skipping export replication.');
  process.exit(0);
}

const targetDir = path.join(outDir, sanitizedBasePath);

await mkdir(targetDir, { recursive: true });

const entries = await readdir(outDir);

for (const entry of entries) {
  if (entry === sanitizedBasePath) {
    continue;
  }

  const src = path.join(outDir, entry);
  const dest = path.join(targetDir, entry);
  const stats = await lstat(src);

  if (stats.isSymbolicLink()) {
    const linkTarget = await readlink(src);
    const resolvedTarget = path.resolve(path.dirname(src), linkTarget);
    const targetStats = await lstat(resolvedTarget);

    if (targetStats.isDirectory()) {
      await cp(resolvedTarget, dest, { recursive: true, force: true });
    } else {
      await copyFile(resolvedTarget, dest);
    }

    continue;
  }

  if (stats.isDirectory()) {
    await cp(src, dest, { recursive: true, force: true });
  } else {
    await copyFile(src, dest);
  }
}

console.log(`Replicated Next.js export into ${path.relative(process.cwd(), targetDir)} for basePath /${sanitizedBasePath}.`);
