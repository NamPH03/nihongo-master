// c:\Users\NamPH's PC\Projects\nihongo-master\src\app\api\debug\check-xlsx-headers\route.ts
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  const isLocal = req.headers.get("host")?.includes("localhost") || req.headers.get("host")?.includes("127.0.0.1");

  if (secret !== cronSecret && !isLocal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const filePath = path.join(process.cwd(), "Vocabulary", "IT_vocab", "IT_vocab.xlsx");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return NextResponse.json({
      sheetNames: workbook.SheetNames,
      firstRow: rows[0] || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg });
  }
}
