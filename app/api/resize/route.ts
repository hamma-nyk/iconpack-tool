import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import archiver from "archiver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const size = parseInt((formData.get("size") as string) || "128");

    if (!files.length)
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });

    const outputDir = path.join(process.cwd(), "tmp_resize");
    fs.mkdirSync(outputDir, { recursive: true });
    const processed: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const outPath = path.join(outputDir, file.name);
      await sharp(buffer)
        .resize(size, size, { fit: "contain" })
        .png()
        .toFile(outPath);
      processed.push(outPath);
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", (err) => {
      throw err;
    });

    for (const p of processed) archive.file(p, { name: path.basename(p) });

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        // "Content-Disposition": 'attachment; filename="resize_results.zip"',
      },
    });
  } catch (err: any) {
    console.error("Resize error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
