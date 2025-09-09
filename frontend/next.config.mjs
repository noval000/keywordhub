/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // Включаем standalone режим для Docker
    output: 'standalone',

    // Настройки для работы в контейнере
    experimental: {
        outputFileTracingRoot: undefined,
    },
};

export default nextConfig;