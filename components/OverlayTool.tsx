"use client";

import { useState, useEffect, useRef } from "react";

export default function OverlayTool() {
  const [color, setColor] = useState("#0066ff");
  const [opacity, setOpacity] = useState(0.4);
  const [files, setFiles] = useState<FileList | null>(null);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  // === Generate preview (maks 24) ===
  useEffect(() => {
    if (!files?.length) {
      setPreviews([]);
      return;
    }

    const limited = Array.from(files).slice(0, 24);
    const urls = limited.map((f) => URL.createObjectURL(f));
    setPreviews(urls);

    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // === Apply overlay ke setiap canvas preview ===
  useEffect(() => {
    previews.forEach((src, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.src = src;
      img.onload = () => {
        const scale = Math.min(1, 100 / Math.max(img.width, img.height));
        const w = img.width * scale;
        const h = img.height * scale;
        canvas.width = w;
        canvas.height = h;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      };
    });
  }, [previews, color, opacity]);
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
    form.append("color", color);
    form.append("opacity", opacity.toString());

    try {
      const res = await fetch("/api/overlay", {
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
  return (
    <div className="flex items-start justify-center text-white gap-8 p-8">
      {/* === Area Wallpaper + Preview === */}
      <div
        className="relative min-w-md max-w-lg aspect-[9/16] rounded-2xl overflow-hidden border border-neutral-800 shadow-lg bg-neutral-900"
        style={{
          backgroundImage: wallpaper ? `url(${wallpaper})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Overlay Grid */}
        {previews.length > 0 && (
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 gap-4 p-8 place-items-center">
            {Array.from({ length: 24 }).map((_, idx) => {
              // ambil index dari belakang agar urutan dari bawah ke atas
              const revIndex = 23 - idx;
              const src = previews[revIndex];
              if (!src) return <div key={idx} />; // cell kosong

              return (
                <canvas
                  key={idx}
                  ref={(el) => {
                    canvasRefs.current[revIndex] = el;
                  }}
                  className="rounded-2xl backdrop-blur-sm"
                  style={{ width: 70, height: 70 }}
                />
              );
            })}
          </div>
        )}

        {!previews.length && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            Upload gambar untuk melihat preview di atas wallpaper
          </div>
        )}
      </div>

      {/* === Panel Kontrol === */}
      <div className="bg-neutral-900 p-6 rounded-2xl min-w-md max-w-lg flex flex-col gap-4 shadow-lg">
        {/* Input Wallpaper */}
        <label className="font-semibold">Wallpaper (background):</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setWallpaper(URL.createObjectURL(file));
          }}
          className="p-2 rounded bg-neutral-800"
        />

        {/* Input Gambar */}
        <label className="font-semibold">Gambar (maks 6):</label>
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
              {files.length} file siap di-overlay ✅
              {files.length > 6 && (
                <span className="block text-xs text-yellow-400 mt-1">
                  (Preview hanya 6 gambar pertama)
                </span>
              )}
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

        {/* Picker dan Slider */}
        <label className="font-semibold mt-2">Overlay Color:</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-16 h-10 cursor-pointer"
        />

        <label className="font-semibold">Opacity: {opacity.toFixed(1)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full accent-blue-600"
        />

        <button
          onClick={handleUpload}
          className="mt-2 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold transition"
        >
          Jalankan Overlay
        </button>

        {status && <p className="text-sm text-gray-300">{status}</p>}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download="overlay_results.zip"
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg mt-3 inline-block font-semibold"
          >
            ⬇️ Download ZIP Hasil
          </a>
        )}
      </div>
    </div>
  );
}
