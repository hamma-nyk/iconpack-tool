import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import archiver from "archiver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const color = (formData.get("color") as string) || "#0066ff";
    const opacity = parseFloat((formData.get("opacity") as string) || "0.5");
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const outputDir = path.join(process.cwd(), "tmp_overlay");
    fs.mkdirSync(outputDir, { recursive: true });
    const processedPaths: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const img = sharp(buffer).ensureAlpha();
      const metadata = await img.metadata();

      // Ambil alpha channel untuk mask transparansi
      const { data: alphaBuffer } = await img
        .clone()
        .extractChannel("alpha")
        .toBuffer({ resolveWithObject: true });

      // Buat layer warna overlay
      const colorLayer = Buffer.from(`
        <svg width="${metadata.width}" height="${metadata.height}">
          <rect width="100%" height="100%" fill="${color}" opacity="${opacity}" />
        </svg>
      `);

      // Layer warna hanya pada area isi (berdasarkan alpha)
      const tinted = await sharp(colorLayer)
        .ensureAlpha()
        .joinChannel(alphaBuffer)
        .png()
        .toBuffer();

      // Sekarang tumpuk overlay di atas gambar asli
      const outPath = path.join(outputDir, file.name);
      const result_tinted = await sharp(tinted)
        .ensureAlpha()
        .composite([{ input: buffer, blend: "dest-in" }]) // numpuk di atas
        .png()
        .toBuffer();

      await sharp(buffer)
        .ensureAlpha()
        .composite([{ input: result_tinted, blend: "over" }]) // numpuk di atas
        .png()
        .toFile(outPath);

      processedPaths.push(outPath);
    }

    // === ZIP hasil ===
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", (err: Error) => {
      throw err;
    });

    for (const p of processedPaths) {
      archive.file(p, { name: path.basename(p) });
    }

    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        // "Content-Disposition": 'attachment; filename="overlay_results.zip"',
      },
    });
  } catch (err: any) {
    console.error("Overlay error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
