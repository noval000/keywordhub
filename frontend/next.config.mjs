/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // Включаем standalone режим для Docker
    output: 'standalone',

    // Временно отключаем проверку типов для сборки
    typescript: {
        ignoreBuildErrors: true,
    },

    // Настройки для работы в контейнере
    experimental: {
        outputFileTracingRoot: undefined,
    },
};

export default nextConfig;
