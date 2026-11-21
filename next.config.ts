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
    // The tracer finds onnxruntime_binding.node but not the shared library it loads.
    "/api/reports": ["./models/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so.1"],
    "/api/incidents/*/reclassify": ["./models/**/*", "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so.1"],
  },
};

export default nextConfig;
