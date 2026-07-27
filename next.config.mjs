/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tắt X-Powered-By header (nhỏ nhưng tốt cho bảo mật)
  poweredByHeader: false,

  // Tối ưu hình ảnh
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // server-side packages — không bundle vào client
  experimental: {
    serverExternalPackages: ["firebase-admin", "pdf-parse"],
  },

  // Cache headers cho static assets  
  async headers() {
    return [
      {
        // SVG kanji — immutable, cache 1 năm
        source: "/kanji/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // PWA icons và manifest
        source: "/(icon-:size.png|manifest.json)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
