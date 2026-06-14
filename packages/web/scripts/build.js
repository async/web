import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const packageRoot = root.pathname;
const dist = join(packageRoot, 'dist');
const routerDist = join(packageRoot, '../router/dist');
const runtimeDist = join(packageRoot, '../webruntime/dist');

rmSync(dist, {
  recursive: true,
  force: true
});

assertInternalPackageBuilt(routerDist, '@async/router');
assertInternalPackageBuilt(runtimeDist, '@async/webruntime');

execFileSync('tsc', [
  '-p',
  'tsconfig.build.json'
], {
  cwd: packageRoot,
  stdio: 'inherit'
});

copyInternalPackage(routerDist, join(dist, 'router'));
copyInternalPackage(runtimeDist, join(dist, 'runtime'));
rewritePublicSpecifiers(dist);

function assertInternalPackageBuilt(directory, label) {
  if (!existsSync(directory)) {
    throw new Error(`${label} must be built before @async/web can embed it. Run pnpm run build from the workspace root.`);
  }
}

function copyInternalPackage(from, to) {
  if (!existsSync(from)) {
    throw new Error(`${from} does not exist.`);
  }
  cpSync(from, to, {
    recursive: true
  });
}

function rewritePublicSpecifiers(directory) {
  for (const file of walk(directory)) {
    const extension = extname(file);
    if (extension !== '.js' && extension !== '.ts') {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const rewritten = source
      .replaceAll('@async/webruntime/platform', '@async/web/runtime/platform')
      .replaceAll('@async/webruntime/vite', '@async/web/runtime/vite')
      .replaceAll('@async/webruntime', '@async/web/runtime')
      .replaceAll('@async/router', '@async/web/router');
    if (rewritten !== source) {
      writeFileSync(file, rewritten);
    }
  }
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, {
    withFileTypes: true
  })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files.sort((left, right) => relative(directory, left).localeCompare(relative(directory, right)));
}
