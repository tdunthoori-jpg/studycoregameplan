/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@react-pdf/renderer',
      'puppeteer',
      'puppeteer-core',
      '@sparticuz/chromium-min',
    ],
  },
};

module.exports = nextConfig;
