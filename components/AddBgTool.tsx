"use client";

import { useState, useEffect, useRef } from "react";

const BG_OPTIONS = [
  { name: "Rounded", src: "/bg/rounded.png" },
  { name: "Circle", src: "/bg/circle.png" },
  { name: "Transparent", src: "/bg/transparent.png" },
  // tambahkan bg lain jika mau
];

export default function AddBgTool() {
  const [bg, setBg] = useState(BG_OPTIONS[0].src);
  const [files, setFiles] = useState<FileList | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [invert, setInvert] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain"); // ✅ toggle mode
  const [status, setStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  // === Generate preview (maks 6) ===
  useEffect(() => {
    if (!files?.length) {
      setPreviews([]);
      return;
    }
    const limited = Array.from(files).slice(0, 6);
    const urls = limited.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // === Render preview: background + icon ===
  useEffect(() => {
    previews.forEach((src, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bgImg = new Image();
      const iconImg = new Image();
      bgImg.src = bg;
      iconImg.src = src;

      bgImg.onload = () => {
        const size = 192;
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(bgImg, 0, 0, size, size);

        iconImg.onload = () => {
          const iconSize = size * scale;
          const x = (size - iconSize) / 2;
          const y = (size - iconSize) / 2;

          if (invert) {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = iconSize;
            tempCanvas.height = iconSize;
            const tempCtx = tempCanvas.getContext("2d");
            if (!tempCtx) return;

            tempCtx.drawImage(iconImg, 0, 0, iconSize, iconSize);
            const imgData = tempCtx.getImageData(0, 0, iconSize, iconSize);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }
            tempCtx.putImageData(imgData, 0, 0);
            ctx.drawImage(tempCanvas, x, y, iconSize, iconSize);
          } else {
            ctx.drawImage(iconImg, x, y, iconSize, iconSize);
          }
        };
      };
    });
  }, [previews, bg, invert, scale]);

  // === Drag & Drop ===
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length) setFiles(droppedFiles);
  };

  // === Upload ke backend ===
  const handleUpload = async () => {
    if (!files?.length) {
      alert("Pilih atau drag gambar dulu!");
      return;
    }

    setStatus("⏳ Processing...");
    setDownloadUrl(null);

    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    form.append("bg", bg);
    form.append("invert", invert ? "true" : "false");
    form.append("scale", scale.toString());
    form.append("fitMode", fitMode); // ✅ kirim mode contain/cover

    try {
      const res = await fetch("/api/addbg", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.text();
        setStatus("❌ Gagal: " + err);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("✅ Selesai! Klik tombol di bawah untuk download ZIP hasil.");
    } catch (err: any) {
      setStatus("❌ Gagal mengirim data: " + err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center bg-neutral-950 text-white gap-8 p-8">
      {/* === BG Picker === */}
      <h2 className="text-md font-bold">Background Shape:</h2>
      <div className="flex gap-4 mb-4">
        {BG_OPTIONS.map((b) => (
          <button
            key={b.src}
            onClick={() => setBg(b.src)}
            className={`rounded-xl overflow-hidden border-2 ${
              bg === b.src ? "border-blue-500" : "border-neutral-700"
            }`}
          >
            <img src={b.src} alt={b.name} width={64} height={64} />
          </button>
        ))}
      </div>

      {/* === Control Panel === */}
      <div className="bg-neutral-900 p-6 rounded-2xl w-full max-w-md flex flex-col gap-4 shadow-lg">
        <label className="font-semibold">Upload Icon Files:</label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
            isDragging ? "border-blue-500 bg-blue-500/10" : "border-gray-600"
          }`}
        >
          {files?.length ? (
            <p className="text-green-400">
              {files.length} file siap ditambahkan background ✅
              {files.length > 6 && (
                <span className="block text-xs text-yellow-400 mt-1">
                  (Preview hanya 6 gambar pertama)
                </span>
              )}
            </p>
          ) : (
            <p className="text-gray-400">
              Drag & drop icon ke sini <br /> atau klik di bawah 👇
            </p>
          )}
        </div>

        <input
          type="file"
          multiple
          accept="image/png,image/jpeg"
          onChange={(e) => setFiles(e.target.files)}
          className="p-2 rounded bg-neutral-800"
        />

        {/* === Opsi Invert, Scale, dan Fit Mode === */}
        <div className="flex flex-col gap-4 mt-2">
          <label className="font-semibold flex items-center gap-2">
            <input
              type="checkbox"
              checked={invert}
              onChange={(e) => setInvert(e.target.checked)}
            />
            Invert Icon
          </label>

          <div className="flex flex-col items-start">
            <label className="font-semibold">
              Scale: {(scale * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0.3}
              max={2}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold">Mode:</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={fitMode === "contain"}
                  onChange={() => setFitMode("contain")}
                />
                Contain
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={fitMode === "cover"}
                  onChange={() => setFitMode("cover")}
                />
                Clip
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={handleUpload}
          className="mt-2 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold transition"
        >
          Tambahkan Background
        </button>
        {/* === Preview Grid === */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-3">
            {Array.from({ length: 3 }).map((_, i) => {
              const src = previews[i];
              return src ? (
                <canvas
                  key={i}
                  ref={(el) => {
                    canvasRefs.current[i] = el;
                  }}
                  className="rounded-xl bg-neutral-800 shadow-md"
                  style={{ width: 128, height: 128 }}
                />
              ) : (
                <div
                  key={i}
                  className="w-[128px] h-[128px] rounded-xl bg-neutral-800/40"
                />
              );
            })}
          </div>
        )}
        {status && <p className="text-sm text-gray-300 mt-3">{status}</p>}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download="addbg_results.zip"
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg mt-3 inline-block font-semibold"
          >
            ⬇️ Download ZIP Hasil
          </a>
        )}
      </div>
    </div>
  );
}
