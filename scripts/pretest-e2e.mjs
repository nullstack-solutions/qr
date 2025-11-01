import { spawn } from 'node:child_process';

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });

await run('npm', ['run', 'build'], {
  env: {
    ...process.env,
    BASE_PATH: '/',
    NEXT_PUBLIC_BASE_PATH: '/',
  }
});
process.env.BASE_PATH = '/';
process.env.NEXT_PUBLIC_BASE_PATH = '/';
await run('node', ['scripts/prepare-export.mjs']);

const installArgs = ['install'];

if (process.platform === 'linux' && (process.env.CI || process.env.PLAYWRIGHT_INSTALL_DEPS === '1')) {
  installArgs.push('--with-deps');
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
await run(npxCommand, ['playwright', ...installArgs]);
