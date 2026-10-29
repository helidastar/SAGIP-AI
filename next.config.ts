import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**",
      "training/**",
      "benchmark/**",
    ],
  },
  outputFileTracingIncludes: {
    "/api/reports": ["./models/**/*"],
    "/api/incidents/[id]/reclassify": ["./models/**/*"],
  },
};

export default nextConfig;
