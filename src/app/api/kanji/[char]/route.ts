// src/app/api/kanji/[char]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getKanjiVGCode(char: string): string {
  const code = char.charCodeAt(0).toString(16);
  return code.padStart(5, "0");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { char: string } }
) {
  try {
    const char = decodeURIComponent(params.char);
    if (!char) {
      return NextResponse.json({ error: "Missing character" }, { status: 400 });
    }

    const code = getKanjiVGCode(char);
    const filePath = path.join(process.cwd(), "public", "kanji", `${code}.svg`);

    // Dùng async readFile thay vì sync — không block event loop
    let svgText: string;
    try {
      svgText = await fs.readFile(filePath, "utf8");
    } catch {
      return NextResponse.json({ error: "Kanji SVG not found" }, { status: 404 });
    }

    // Tối ưu hóa SVG để hỗ trợ đổi màu linh hoạt theo CSS (stroke="currentColor")
    svgText = svgText
      .replace(/stroke:\s*#[0-9a-fA-F]{3,6}/g, "stroke: currentColor")
      .replace(/stroke="#[0-9a-fA-F]{3,6}"/g, 'stroke="currentColor"');

    return new NextResponse(svgText, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("API Kanji Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
