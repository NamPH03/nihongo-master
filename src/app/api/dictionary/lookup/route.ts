import { NextRequest, NextResponse } from "next/server";

function containsVietnamese(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(text);
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text?.trim()) return "";

  const encoded = encodeURIComponent(text.trim());
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) return text;

    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0]
          .map((item: any) => item?.[0])
          .filter(Boolean)
          .join(" ; ")
      : "";

    return translated || text;
  } catch {
    return text;
  }
}

async function translateToVietnamese(text: string): Promise<string> {
  return translateText(text, "en", "vi");
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("word");
  const language = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "vi";

  if (!keyword || keyword.trim().length < 1) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    const normalizedKeyword = keyword.trim();
    const lookupKeyword = language === "vi" && containsVietnamese(normalizedKeyword)
      ? await translateText(normalizedKeyword, "vi", "en")
      : normalizedKeyword;

    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(lookupKeyword)}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    }

    const data = await res.json();
    const entries = Array.isArray(data?.data) ? data.data : [];

    const transformed = await Promise.all(
      entries.map(async (entry: any) => {
        const originalSenses = Array.isArray(entry?.senses) ? entry.senses : [];
        const translatedSenses = await Promise.all(
          originalSenses.map(async (sense: any) => {
            const englishDefinitions = Array.isArray(sense?.english_definitions)
              ? sense.english_definitions
              : [];
            const partsOfSpeech = Array.isArray(sense?.parts_of_speech)
              ? sense.parts_of_speech
              : [];
            const tags = Array.isArray(sense?.tags) ? sense.tags : [];

            const translatedDefinitions = language === "en"
              ? englishDefinitions
              : await Promise.all(englishDefinitions.slice(0, 2).map((def: string) => translateToVietnamese(def)));

            return {
              ...sense,
              english_definitions: language === "en" ? englishDefinitions : translatedDefinitions,
              parts_of_speech: partsOfSpeech,
              tags,
              translated_definitions: language === "en" ? englishDefinitions : translatedDefinitions,
            };
          })
        );

        return {
          ...entry,
          senses: translatedSenses,
        };
      })
    );

    return NextResponse.json({ ...data, data: transformed });
  } catch (error) {
    console.error("Dictionary lookup error:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
