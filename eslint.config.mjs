import nextConfig from 'eslint-config-next';

const [baseConfig, ...restConfigs] = nextConfig;

const config = [
  {
    ...baseConfig,
    rules: {
      ...baseConfig.rules,
      '@next/next/no-img-element': 'off',
    },
  },
  ...restConfigs,
];

export default config;
