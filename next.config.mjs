/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    workerThreads: false,
    esmExternals: 'loose'
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /batchGenerator\.worker\.(ts|js)$/,
      use: [{
        loader: 'worker-loader',
        options: {
          filename: 'static/chunks/[name].[contenthash].js'
        }
      }]
    });
    return config;
  }
};

export default nextConfig;
