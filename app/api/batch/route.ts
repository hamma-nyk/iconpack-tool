// app/api/batch/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import archiver from "archiver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // === PARAMETER ===
    const bg = formData.get("bg") as string; // contoh: /bg/rounded.png
    const invert = formData.get("invert") === "true";
    const scale = parseFloat(formData.get("scale") as string) || 1;
    const color = (formData.get("color") as string) || "#0066ff";
    const opacity = parseFloat((formData.get("opacity") as string) || "0.4");
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // === SETUP ===
    const outputDir = path.join(process.cwd(), "tmp_batch");
    fs.mkdirSync(outputDir, { recursive: true });
    const processedPaths: string[] = [];

    // === BACKGROUND ===
    const bgPath = path.join(process.cwd(), "public", bg.replace(/^\/+/, ""));
    const bgBuffer = fs.readFileSync(bgPath);
    const bgSize = 192;

    // === LOOP ICONS ===
    for (const file of files) {
      const iconBuffer = Buffer.from(await file.arrayBuffer());

      // STEP 1️⃣: Resize icon sesuai scale
      let icon = sharp(iconBuffer)
        .resize({
          width: Math.round(bgSize * scale),
          height: Math.round(bgSize * scale),
          fit: "contain",
        })
        .ensureAlpha();

      if (invert) icon = icon.negate({ alpha: false });

      const iconResized = await icon.png().toBuffer();
      const meta = await sharp(iconResized).metadata();
      const iw = meta.width || bgSize;
      const ih = meta.height || bgSize;

      // STEP 2️⃣: Buat canvas fix 192x192 untuk center/crop icon
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
        const offsetX = Math.round((bgSize - iw) / 2);
        const offsetY = Math.round((bgSize - ih) / 2);
        iconFinal = await canvas
          .composite([{ input: iconResized, left: offsetX, top: offsetY }])
          .png()
          .toBuffer();
      } else {
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

      // STEP 3️⃣: Composite icon ke background
      const bgComposited = await sharp(bgBuffer)
        .resize(bgSize, bgSize)
        .composite([{ input: iconFinal, blend: "over" }])
        .ensureAlpha()
        .png()
        .toBuffer();

      // CLONE SHAPE
      const buffer = bgComposited;
      const img = sharp(buffer).ensureAlpha();
      const metadata = await img.metadata();

      // Ambil alpha channel untuk mask transparansi
      const { data: alphaBuffer } = await img
        .clone()
        .extractChannel("alpha")
        .toBuffer({ resolveWithObject: true });

      // STEP 4️⃣: Tambahkan overlay warna dengan opacity
      const { width, height } = await sharp(bgComposited).metadata();

      const colorLayer = Buffer.from(`
          <svg width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="${color}" opacity="${opacity}" />
          </svg>
        `);

      // Layer warna hanya pada area isi (berdasarkan alpha)
      const tinted = await sharp(colorLayer)
        .ensureAlpha()
        .joinChannel(alphaBuffer)
        .png()
        .toBuffer();

      const result_tinted = await sharp(tinted)
        .ensureAlpha()
        .composite([{ input: buffer, blend: "dest-in" }]) // numpuk di atas
        .png()
        .toBuffer();

      const finalImage = await sharp(buffer)
        .composite([{ input: result_tinted, blend: "over" }])
        .png()
        .toBuffer();

      // === Simpan hasil ===
      const outPath = path.join(outputDir, file.name);
      fs.writeFileSync(outPath, finalImage);
      processedPaths.push(outPath);
    }

    // STEP 5️⃣: ZIP semua hasil
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
        "Content-Disposition": 'attachment; filename="batch_results.zip"',
      },
    });
  } catch (err: any) {
    console.error("Batch Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
