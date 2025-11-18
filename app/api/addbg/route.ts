import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import archiver from "archiver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const bg = formData.get("bg") as string;
    const invert = formData.get("invert") === "true";
    const scale = parseFloat(formData.get("scale") as string) || 1;
    const fitMode =
      (formData.get("fitMode") as string) === "cover" ? "cover" : "contain";
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const outputDir = path.join(process.cwd(), "tmp_addbg");
    fs.mkdirSync(outputDir, { recursive: true });
    const processedPaths: string[] = [];

    // === Load background ===
    const bgPath = path.join(process.cwd(), "public", bg.replace(/^\/+/, ""));
    const bgBuffer = fs.readFileSync(bgPath);
    const bgSize = 192; // 🔥 Background fix 192px

    for (const file of files) {
      const iconBuffer = Buffer.from(await file.arrayBuffer());

      // Resize icon sesuai scale (bisa >100%)
      let icon = sharp(iconBuffer).resize({
        width: Math.round(bgSize * scale),
        height: Math.round(bgSize * scale),
        fit: fitMode,
      });
      if (invert) icon = icon.negate({ alpha: false });

      const iconResized = await icon.png().toBuffer();
      const iconMeta = await sharp(iconResized).metadata();
      const iw = iconMeta.width || bgSize;
      const ih = iconMeta.height || bgSize;

      // === Buat canvas fix 192x192 untuk meletakkan icon ===
      const canvas = sharp({
        create: {
          width: bgSize,
          height: bgSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });

      let iconFinal: Buffer;

      if (scale <= 1) {
        // Icon kecil → center di tengah
        const offsetX = Math.round((bgSize - iw) / 2);
        const offsetY = Math.round((bgSize - ih) / 2);
        iconFinal = await canvas
          .composite([{ input: iconResized, left: offsetX, top: offsetY }])
          .png()
          .toBuffer();
      } else {
        // Icon besar → crop bagian tengah supaya hasil tetap 192x192
        const left = Math.max(0, Math.round((iw - bgSize) / 2));
        const top = Math.max(0, Math.round((ih - bgSize) / 2));

        const cropped = await sharp(iconResized)
          .extract({
            left,
            top,
            width: bgSize,
            height: bgSize,
          })
          .png()
          .toBuffer();

        iconFinal = cropped;
      }

      // === Composite ke background 192x192 ===
      const final = await sharp(bgBuffer)
        .resize(bgSize, bgSize)
        .composite([{ input: iconFinal, blend: "over" }])
        .png()
        .toBuffer();

      const outPath = path.join(outputDir, file.name);
      fs.writeFileSync(outPath, final);
      processedPaths.push(outPath);
    }

    // === ZIP hasil ===
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", (err) => {
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
        // "Content-Disposition": 'attachment; filename="addbg_results.zip"',
      },
    });
  } catch (err: any) {
    console.error("AddBg Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
