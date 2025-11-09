"use client";

import { useState } from "react";
import OverlayTool from "@/components/OverlayTool";
import ResizeTool from "@/components/ResizeTool";
import AddBgTool from "@/components/AddBgTool";

export default function HomePage() {
  const [mode, setMode] = useState<"overlay" | "addbg" | "resize">("addbg");

  return (
    <div className="flex flex-col items-center min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold text-center mb-3">
        🧰 Icon Tools Dashboard
      </h1>
      <p className="text-center text-neutral-400 text-sm mb-8">
        Pilih mode untuk memanipulasi ikon. Tools ini hanya support [xxhdpi]
      </p>

      {/* Pilihan Mode */}
      <div className="flex gap-4">
        <button
          onClick={() => setMode("addbg")}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            mode === "addbg"
              ? "bg-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          🧩 Add Background
        </button>
        <button
          onClick={() => setMode("overlay")}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            mode === "overlay"
              ? "bg-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          🎨 Overlay Color
        </button>
        <button
          onClick={() => setMode("resize")}
          className={`px-6 py-2 rounded-lg font-semibold transition ${
            mode === "resize"
              ? "bg-blue-600"
              : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          📏 Resize Icon
        </button>
      </div>

      {/* View Mode */}
      <div className="w-full flex justify-center">
        {mode === "addbg" && <AddBgTool />}
        {mode === "overlay" && <OverlayTool />}
        {mode === "resize" && <ResizeTool />}
      </div>
    </div>
  );
}
