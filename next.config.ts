import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Excel テンプレート（templates/*.xlsx / cell_mappings/*.json）と PDF テンプレートを
  // Vercel Functions のバンドルに含めるため、ファイルトレーシングに明示追加。
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./templates/**/*",
    ],
  },
};

export default nextConfig;
