/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tắt X-Powered-By header (nhỏ nhưng tốt cho bảo mật)
  poweredByHeader: false,

  // Tối ưu hình ảnh
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // server-side packages — Next.js 14 syntax (Next.js 15+ uses serverExternalPackages)
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
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
