"use client";

import { useState, useEffect, useRef } from "react";

export default function ResizeTool() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [size, setSize] = useState(192); // default 192px
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // === Generate preview (hanya 1 gambar) ===
  useEffect(() => {
    if (!files?.length) {
      setPreview(null);
      setLoadedImg(null);
      return;
    }

    const file = files[0];
    const url = URL.createObjectURL(file);
    setPreview(url);

    // pre-load image once
    const img = new Image();
    img.src = url;
    img.onload = () => setLoadedImg(img);

    return () => {
      URL.revokeObjectURL(url);
      setLoadedImg(null);
    };
  }, [files]);

  // === Gambar ulang hanya saat image sudah loaded atau size berubah ===
  useEffect(() => {
    if (!loadedImg || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = size;
    const h = size;
    canvas.width = w;
    canvas.height = h;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(loadedImg, 0, 0, w, h);
  }, [loadedImg, size]);

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
    form.append("size", size.toString());

    try {
      const res = await fetch("/api/resize", {
        method: "POST",
        body: form,
      });

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

  const handleSizeChange = (value: number) => {
    if (value < 50) value = 50;
    if (value > 192) value = 192;
    setSize(value);
  };

  return (
    <div className="flex items-start justify-center text-white gap-8 p-8">
      <div className="flex items-start gap-8">
        {/* === Preview Canvas === */}
        <div
          className="bg-neutral-900 min-w-[192px] min-h-[192px] rounded-2xl border border-neutral-800 flex items-center justify-center overflow-hidden shadow-lg"
          style={{ width: 192, height: 192 }}
        >
          {preview ? (
            <canvas
              ref={canvasRef}
              className="rounded-xl transition-all duration-200 ease-in-out"
              style={{
                width: size,
                height: size,
              }}
            />
          ) : (
            <p className="text-gray-500 text-sm text-center p-2">
              Belum ada icon
            </p>
          )}
        </div>

        {/* === Panel Kontrol === */}
        <div className="bg-neutral-900 p-6 rounded-2xl w-full max-w-md flex flex-col gap-4 shadow-lg">
          <label className="font-semibold">Upload Icon:</label>
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
                {files.length} file siap diresize ✅
              </p>
            ) : (
              <p className="text-gray-400">
                Drag & drop gambar ke sini <br /> atau klik di bawah 👇
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

          <label className="font-semibold mt-2">Ukuran (px): {size}</label>
          <input
            type="range"
            min={50}
            max={192}
            step={1}
            value={size}
            onChange={(e) => handleSizeChange(parseInt(e.target.value))}
            className="w-full accent-blue-600"
          />

          <button
            onClick={handleUpload}
            className="mt-2 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold transition"
          >
            Jalankan Resize
          </button>

          {status && <p className="text-sm text-gray-300">{status}</p>}
          {downloadUrl && (
            <a
              href={downloadUrl}
              download="resize_results.zip"
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg mt-3 inline-block font-semibold"
            >
              ⬇️ Download ZIP Hasil
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
