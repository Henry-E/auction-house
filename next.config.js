/** @type {import('next').NextConfig} */

// workaround for ESM module loader errors
// see https://github.com/vercel/next.js/issues/25454
const withTM = require('next-transpile-modules')([
  '@solana/wallet-adapter-base',
  '@solana/wallet-adapter-phantom',
  '@solana/wallet-adapter-sollet',
  '@project-serum/sol-wallet-adapter'
])

module.exports = withTM({
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Important: return the modified config
    if (!isServer) {
      config.resolve.fallback.fs = false
    }
    return config
  },
})
