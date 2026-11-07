import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Na imagem Docker o build gera um servidor autônomo (.next/standalone) sem node_modules completo
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
};

export default nextConfig;
