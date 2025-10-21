/** @type {import('next').NextConfig} */
const repoBasePath = process.env.NEXT_PUBLIC_BASE_PATH
  || process.env.BASE_PATH
  || (process.env.GITHUB_ACTIONS ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}` : '');

const sanitizedBasePath = repoBasePath?.replace(/^\/+/g, '').replace(/\/+$/g, '') ?? '';
const normalizedBasePath = sanitizedBasePath ? `/${sanitizedBasePath}` : '';

const nextConfig = {
  output: 'export',
  basePath: normalizedBasePath,
  assetPrefix: normalizedBasePath || undefined,
  images: {
    unoptimized: true
  },
  reactStrictMode: true,
  experimental: {
    workerThreads: false,
    esmExternals: 'loose'
  }
};

export default nextConfig;
