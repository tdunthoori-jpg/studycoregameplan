/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved out of experimental in Next.js 14.1
  serverExternalPackages: [
    '@react-pdf/renderer',
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium-min',
  ],
};

module.exports = nextConfig;
