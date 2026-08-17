import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bắt buộc: không khai báo thì webpack cố bundle `ssh2` và chết ở native addon
  // optional `cpu-features`. `pg` cũng phải chạy native trên Node runtime.
  serverExternalPackages: ["pg", "ssh2"],
};

export default nextConfig;
