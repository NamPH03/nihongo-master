// src/app/api/dictionary/lookup/route.ts
// Proxy Jisho API — tự động dịch từ tiếng Việt/Anh → tiếng Nhật nếu cần
// Trả về kết quả gốc từ Jisho (EN) + translated_definitions (VI nếu input là VI)

import { NextRequest, NextResponse } from "next/server";

function containsJapanese(text: string): boolean {
  return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
}

function containsVietnamese(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(text);
}

async function translateText(text: string, sl: string, tl: string): Promise<string> {
  if (!text?.trim()) return "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text.trim())}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return text;
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map((item: unknown[]) => (typeof item?.[0] === "string" ? item[0] : "")).filter(Boolean).join("")
      : "";
    return translated || text;
  } catch {
    // Timeout hoặc lỗi mạng → trả về bản gốc
    return text;
  }
}

type DictionarySense = {
  english_definitions?: string[];
  parts_of_speech?: string[];
  tags?: string[];
  [key: string]: unknown;
};

type DictionaryEntry = {
  senses?: DictionarySense[];
  [key: string]: unknown;
};

type DictionaryResponse = {
  data?: DictionaryEntry[];
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("word");

  if (!keyword || keyword.trim().length < 1) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    const q = keyword.trim();
    const isVietnamese = containsVietnamese(q) && !containsJapanese(q);

    // Nếu tiếng Việt → dịch sang tiếng Anh để Jisho hiểu
    const lookupKeyword = isVietnamese ? await translateText(q, "vi", "en") : q;

    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(lookupKeyword)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    }

    const data = (await res.json()) as DictionaryResponse;
    const entries = Array.isArray(data?.data) ? data.data : [];

    // Nếu input là tiếng Việt, dịch các định nghĩa EN → VI
    const shouldTranslate = isVietnamese;

    const transformed = await Promise.all(
      entries.slice(0, 8).map(async (entry) => {
        const senses = Array.isArray(entry?.senses) ? entry.senses : [];
        const translatedSenses = await Promise.all(
          senses.map(async (sense) => {
            const englishDefs = (sense.english_definitions || []).filter(Boolean) as string[];
            // Dùng allSettled: nếu 1 translate thất bại, các định nghĩa khác vẫn ok
            const settledResults = shouldTranslate
              ? await Promise.allSettled(englishDefs.slice(0, 2).map((d) => translateText(d, "en", "vi")))
              : englishDefs.slice(0, 2).map((d) => ({ status: "fulfilled" as const, value: d }));
            const translated_definitions = settledResults.map((r, i) =>
              r.status === "fulfilled" ? r.value : englishDefs[i] ?? ""
            );
            return {
              ...sense,
              english_definitions: englishDefs,
              translated_definitions,
              parts_of_speech: (sense.parts_of_speech || []).filter(Boolean),
              tags: (sense.tags || []).filter(Boolean),
            };
          })
        );
        return { ...entry, senses: translatedSenses };
      })
    );

    return NextResponse.json({ ...data, data: transformed });
  } catch (error) {
    console.error("Dictionary lookup error:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
