import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "uploads", "resumes");
const META = path.join(DIR, "meta.json");

/**
 * GET — stream the uploaded resume bytes for as-is preview/download.
 */
export async function GET() {
  try {
    const raw = await fs.readFile(META, "utf8");
    const meta = JSON.parse(raw) as {
      storedName: string;
      originalName: string;
      mimeType: string;
    };
    const filePath = path.join(DIR, meta.storedName);
    const buf = await fs.readFile(filePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": meta.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${meta.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No uploaded resume" }, { status: 404 });
  }
}
