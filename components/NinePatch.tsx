"use client";

import React, { useEffect, useRef, useState } from "react";
import extract, { PNGChunk } from "png-chunks-extract";
import encode from "png-chunks-encode";
import { Buffer } from "buffer";
/**
 * NinePatchEditorAdvanced.tsx
 *
 * - Editor canvas fixed 700x700
 * - Zoom slider (display scaling)
 * - Pixel inputs (absolute) for stretch and padding (top/right/bottom/left)
 * - Show Patch (green stretch, red padding)
 * - Show Content toggle
 * - Preview panel (stretched simulation)
 * - Drag handles to edit guides
 * - Export .9.png (adds 1px guides)
 *
 * Usage: <NinePatchEditorAdvanced />
 */

type Guide = { start: number; end: number }; // in image coords (px)

export default function NinePatchEditorAdvanced() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);

  // image and natural size
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  // guides in image coordinates (px)
  const [hStretch, setHStretch] = useState<Guide | null>(null); // top stretch (x coords)
  const [vStretch, setVStretch] = useState<Guide | null>(null); // left stretch (y coords)
  const [padH, setPadH] = useState<Guide | null>(null); // bottom padding area (x)
  const [padV, setPadV] = useState<Guide | null>(null); // right padding area (y)

  // UI controls
  const [zoom, setZoom] = useState(1); // display zoom scale (1 = fit to 700 if smaller)
  const [zoomPreview, setZoomPreview] = useState(100); // display zoom scale (1 = fit to 700 if smaller)
  const [showPatch, setShowPatch] = useState(true);
  const [showContent, setShowContent] = useState(true);
  const [maxEditorSize] = useState(620); // fixed editor size
  const [dragging, setDragging] = useState<{
    which:
      | "hStart"
      | "hEnd"
      | "vStart"
      | "vEnd"
      | "pHStart"
      | "pHEnd"
      | "pVStart"
      | "pVEnd"
      | null;
    offset?: number;
  } | null>(null);

  // load image from file
  const handleFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });

      // default guides: middle 40% stretch, padding 10%-90%
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setHStretch({ start: Math.round(w * 0.3), end: Math.round(w * 0.7) });
      setVStretch({ start: Math.round(h * 0.3), end: Math.round(h * 0.7) });
      setPadH({ start: Math.round(w * 0.1), end: Math.round(w * 0.9) });
      setPadV({ start: Math.round(h * 0.1), end: Math.round(h * 0.9) });

      // fit zoom so image fits inside maxEditorSize if larger
      const fit = Math.min(maxEditorSize / w, maxEditorSize / h, 1);
      setZoom(fit || 1);
      // initial draw
      requestAnimationFrame(() => drawAll());
    };
    // revoke when changed
    return () => {
      // nothing to revoke here; will be revoked by browser when blob invalidated by user
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // helper: draw main canvas and preview
  const drawAll = () => {
    drawMainCanvas();
    drawPreview();
  };

  // draw main editor canvas (700x700 box, image centered inside)
  const drawMainCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !natural.w || !natural.h) {
      // clear canvas
      if (canvas) {
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, maxEditorSize, maxEditorSize);
      }
      return;
    }

    // clear
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, maxEditorSize, maxEditorSize);

    // compute display size of image using zoom, but keep image centered in 700 box
    const dispW = Math.round(natural.w * zoom);
    const dispH = Math.round(natural.h * zoom);
    const offsetX = Math.round((maxEditorSize - dispW) / 2);
    const offsetY = Math.round((maxEditorSize - dispH) / 2);
    const tileSize = 10;
    for (let y = 0; y < 700; y += tileSize) {
      for (let x = 0; x < 700; x += tileSize) {
        const isEven = ((x + y) / tileSize) % 2 === 0;
        ctx.fillStyle = isEven ? "rgba(220,220,220,1)" : "rgba(245,245,245,1)";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
    // // background
    // ctx.fillStyle = "#eaeaea";
    // ctx.fillRect(0, 0, maxEditorSize, maxEditorSize);

    // draw image
    ctx.drawImage(img, offsetX, offsetY, dispW, dispH);

    // draw guides if enabled
    const ratio = zoom; // display pixels per image pixel

    // show stretch (green)
    if (showPatch && hStretch) {
      ctx.fillStyle = "rgba(24, 196, 99, 0.35)"; // translucent green
      const x = offsetX + Math.round(hStretch.start * ratio);
      const w = Math.round((hStretch.end - hStretch.start) * ratio);
      ctx.fillRect(x, offsetY, w, 10); // small top band to visualize horizontal stretch

      ctx.fillStyle = "rgba(24, 196, 99, 0.9)";
      ctx.fillRect(x - 3, offsetY - 3, 6, 16); // start handle
      ctx.fillRect(x + w - 3, offsetY - 3, 6, 16); // end handle
    }

    if (showPatch && vStretch) {
      ctx.fillStyle = "rgba(24, 196, 99, 0.35)";
      const y = offsetY + Math.round(vStretch.start * ratio);
      const h = Math.round((vStretch.end - vStretch.start) * ratio);
      ctx.fillRect(offsetX, y, 10, h);

      ctx.fillStyle = "rgba(24, 196, 99, 0.9)";
      ctx.fillRect(offsetX - 3, y - 3, 16, 6); // start handle
      ctx.fillRect(offsetX - 3, y + h - 3, 16, 6); // end handle
    }

    // show padding (red) on bottom and right
    if (showPatch && padH) {
      ctx.strokeStyle = "rgba(220, 38, 38, 0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      const y = offsetY + dispH - 8;
      ctx.beginPath();
      ctx.moveTo(offsetX + Math.round(padH.start * ratio), y);
      ctx.lineTo(offsetX + Math.round(padH.end * ratio), y);
      ctx.stroke();
      ctx.setLineDash([]);
      // small handles
      ctx.fillStyle = "rgba(220, 38, 38, 0.9)";
      ctx.fillRect(offsetX + Math.round(padH.start * ratio) - 3, y - 6, 6, 12);
      ctx.fillRect(offsetX + Math.round(padH.end * ratio) - 3, y - 6, 6, 12);
    }

    if (showPatch && padV) {
      ctx.strokeStyle = "rgba(220, 38, 38, 0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      const x = offsetX + dispW - 8;
      ctx.beginPath();
      ctx.moveTo(x, offsetY + Math.round(padV.start * ratio));
      ctx.lineTo(x, offsetY + Math.round(padV.end * ratio));
      ctx.stroke();
      ctx.setLineDash([]);
      // handles
      ctx.fillStyle = "rgba(220, 38, 38, 0.9)";
      ctx.fillRect(x - 6, offsetY + Math.round(padV.start * ratio) - 3, 12, 6);
      ctx.fillRect(x - 6, offsetY + Math.round(padV.end * ratio) - 3, 12, 6);
    }

    // show content overlay if enabled (using padding guides)
    if (showContent && padH && padV) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      const contentX = offsetX + Math.round(padH.start * ratio);
      const contentY = offsetY + Math.round(padV.start * ratio);
      const contentW = Math.round((padH.end - padH.start) * ratio);
      const contentHh = Math.round((padV.end - padV.start) * ratio);
      ctx.fillRect(contentX, contentY, contentW, contentHh);

      // optional border
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(contentX, contentY, contentW, contentHh);
    }

    // small info
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      `${natural.w}×${natural.h}px (zoom ${(zoom * 100).toFixed(0)}%)`,
      8,
      maxEditorSize - 8
    );
  };

  // draw a preview simulation (256x256) showing stretch in both axes
  const drawPreview = () => {
    const p = previewRef.current;
    const img = imgRef.current;
    if (!p || !img || !hStretch || !vStretch) return;

    const ctx = p.getContext("2d")!;
    const out = 300; // 🔥 canvas fix 700x700
    p.width = out;
    p.height = out;

    const iw = natural.w;
    const ih = natural.h;

    const hS = hStretch.start;
    const hE = hStretch.end;
    const vS = vStretch.start;
    const vE = vStretch.end;

    const leftW = hS;
    const middleW = Math.max(1, hE - hS);
    const rightW = Math.max(0, iw - hE);
    const topH = vS;
    const midH = Math.max(1, vE - vS);
    const bottomH = Math.max(0, ih - vE);

    const hTargetMiddle = Math.max(1, Math.round(middleW * scaleX));
    const vTargetMiddle = Math.max(1, Math.round(midH * scaleY));

    // === Build stretched image (fCanvas)
    const tempW = leftW + hTargetMiddle + rightW;
    const tempH = ih;
    const tCanvas = document.createElement("canvas");
    tCanvas.width = tempW;
    tCanvas.height = tempH;
    const tctx = tCanvas.getContext("2d")!;
    if (leftW > 0) tctx.drawImage(img, 0, 0, leftW, ih, 0, 0, leftW, ih);
    tctx.drawImage(img, hS, 0, middleW, ih, leftW, 0, hTargetMiddle, ih);
    if (rightW > 0)
      tctx.drawImage(
        img,
        hE,
        0,
        rightW,
        ih,
        leftW + hTargetMiddle,
        0,
        rightW,
        ih
      );

    const finalW = tempW;
    const finalH = topH + vTargetMiddle + bottomH;
    const fCanvas = document.createElement("canvas");
    fCanvas.width = finalW;
    fCanvas.height = finalH;
    const fctx = fCanvas.getContext("2d")!;
    if (topH > 0)
      fctx.drawImage(tCanvas, 0, 0, finalW, topH, 0, 0, finalW, topH);
    fctx.drawImage(
      tCanvas,
      0,
      vS,
      finalW,
      midH,
      0,
      topH,
      finalW,
      vTargetMiddle
    );
    if (bottomH > 0)
      fctx.drawImage(
        tCanvas,
        0,
        vE,
        finalW,
        bottomH,
        0,
        topH + vTargetMiddle,
        finalW,
        bottomH
      );

    // === Checkerboard background
    const tileSize = 10;
    for (let y = 0; y < out; y += tileSize) {
      for (let x = 0; x < out; x += tileSize) {
        const isEven = ((x + y) / tileSize) % 2 === 0;
        ctx.fillStyle = isEven ? "#ccc" : "#eee";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // === Zoom object only ===
    ctx.save();
    const zoomFactor = zoomPreview / 100; // slider 20–400 misalnya
    const scaledW = finalW * zoomFactor;
    const scaledH = finalH * zoomFactor;
    const offsetX = (out - scaledW) / 2;
    const offsetY = (out - scaledH) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoomFactor, zoomFactor);

    // gambar hasil stretch
    ctx.drawImage(fCanvas, 0, 0);

    // === Show patch overlay (tetap proporsional ke zoom) ===
    if (showPatch) {
      const sx = hStretch.start;
      const sw = hStretch.end - hStretch.start;
      const sy = vStretch.start;
      const sh = vStretch.end - vStretch.start;
      ctx.fillStyle = "rgba(24,196,99,0.25)";
      ctx.fillRect(0, sy, finalW, sh);
      ctx.fillRect(sx, 0, sw, finalH);
    }

    ctx.restore();

    // Border frame
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, out, out);
  };

  // redraw when guides or zoom change
  useEffect(() => {
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hStretch,
    vStretch,
    padH,
    padV,
    zoom,
    zoomPreview,
    showPatch,
    showContent,
    imageUrl,
  ]);

  // convert mouse client to image coordinates
  const clientToImage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dispW = Math.round(natural.w * zoom);
    const dispH = Math.round(natural.h * zoom);
    const offsetX = Math.round((maxEditorSize - dispW) / 2);
    const offsetY = Math.round((maxEditorSize - dispH) / 2);

    // clamp to image area
    const xInDisp = Math.min(Math.max(clientX - rect.left - offsetX, 0), dispW);
    const yInDisp = Math.min(Math.max(clientY - rect.top - offsetY, 0), dispH);

    const imgX = Math.round(xInDisp / zoom);
    const imgY = Math.round(yInDisp / zoom);
    return { imgX, imgY };
  };

  // mousedown: detect near handles
  const onMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dispW = Math.round(natural.w * zoom);
    const dispH = Math.round(natural.h * zoom);
    const offsetX = Math.round((maxEditorSize - dispW) / 2);
    const offsetY = Math.round((maxEditorSize - dispH) / 2);

    const threshold = 10; // px in display coords

    // horizontal stretch handles
    if (hStretch) {
      const sX = offsetX + Math.round(hStretch.start * zoom);
      const eX = offsetX + Math.round(hStretch.end * zoom);
      if (Math.abs(mx - sX) <= threshold && Math.abs(my - offsetY) <= 30) {
        setDragging({ which: "hStart", offset: mx - sX });
        return;
      }
      if (Math.abs(mx - eX) <= threshold && Math.abs(my - offsetY) <= 30) {
        setDragging({ which: "hEnd", offset: mx - eX });
        return;
      }
      // click on top band move whole region (start)
      if (my <= offsetY + 12 && mx >= sX && mx <= eX) {
        setDragging({ which: "hStart", offset: mx - sX });
        return;
      }
    }

    // vertical stretch handles
    if (vStretch) {
      const sY = offsetY + Math.round(vStretch.start * zoom);
      const eY = offsetY + Math.round(vStretch.end * zoom);
      if (Math.abs(my - sY) <= threshold && Math.abs(mx - offsetX) <= 30) {
        setDragging({ which: "vStart", offset: my - sY });
        return;
      }
      if (Math.abs(my - eY) <= threshold && Math.abs(mx - offsetX) <= 30) {
        setDragging({ which: "vEnd", offset: my - eY });
        return;
      }
      if (mx <= offsetX + 12 && my >= sY && my <= eY) {
        setDragging({ which: "vStart", offset: my - sY });
        return;
      }
    }

    // padding bottom handles (padH)
    if (padH) {
      const yPad = offsetY + dispH - 8;
      const sX = offsetX + Math.round(padH.start * zoom);
      const eX = offsetX + Math.round(padH.end * zoom);
      if (Math.abs(my - yPad) <= 12) {
        if (Math.abs(mx - sX) <= threshold) {
          setDragging({ which: "pHStart", offset: mx - sX });
          return;
        }
        if (Math.abs(mx - eX) <= threshold) {
          setDragging({ which: "pHEnd", offset: mx - eX });
          return;
        }
      }
    }

    // padding right handles (padV)
    if (padV) {
      const xPad = offsetX + dispW - 8;
      const sY = offsetY + Math.round(padV.start * zoom);
      const eY = offsetY + Math.round(padV.end * zoom);
      if (Math.abs(mx - xPad) <= 12) {
        if (Math.abs(my - sY) <= threshold) {
          setDragging({ which: "pVStart", offset: my - sY });
          return;
        }
        if (Math.abs(my - eY) <= threshold) {
          setDragging({ which: "pVEnd", offset: my - eY });
          return;
        }
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !imgRef.current) return;
    const { imgX, imgY } = clientToImage(e.clientX, e.clientY);

    if (dragging.which === "hStart" && hStretch) {
      const newStart = Math.min(hStretch.end - 1, Math.max(0, imgX));
      setHStretch({ start: newStart, end: hStretch.end });
      // sync input padding if needed
    } else if (dragging.which === "hEnd" && hStretch) {
      const newEnd = Math.max(hStretch.start + 1, Math.min(natural.w, imgX));
      setHStretch({ start: hStretch.start, end: newEnd });
    } else if (dragging.which === "vStart" && vStretch) {
      const newStart = Math.min(vStretch.end - 1, Math.max(0, imgY));
      setVStretch({ start: newStart, end: vStretch.end });
    } else if (dragging.which === "vEnd" && vStretch) {
      const newEnd = Math.max(vStretch.start + 1, Math.min(natural.h, imgY));
      setVStretch({ start: vStretch.start, end: newEnd });
    } else if (dragging.which === "pHStart" && padH) {
      const newStart = Math.min(padH.end - 1, Math.max(0, imgX));
      setPadH({ start: newStart, end: padH.end });
    } else if (dragging.which === "pHEnd" && padH) {
      const newEnd = Math.max(padH.start + 1, Math.min(natural.w, imgX));
      setPadH({ start: padH.start, end: newEnd });
    } else if (dragging.which === "pVStart" && padV) {
      const newStart = Math.min(padV.end - 1, Math.max(0, imgY));
      setPadV({ start: newStart, end: padV.end });
    } else if (dragging.which === "pVEnd" && padV) {
      const newEnd = Math.max(padV.start + 1, Math.min(natural.h, imgY));
      setPadV({ start: padV.start, end: newEnd });
    }
  };

  const onMouseUp = () => {
    setDragging(null);
  };

  // wire global mouseup in case pointer leaves canvas
  useEffect(() => {
    const up = () => setDragging(null);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // input handlers (pixel absolute)
  const updateHStretchFromInputs = (start: number, end: number) => {
    const s = Math.max(0, Math.min(start, natural.w - 1));
    const e = Math.max(s + 1, Math.min(end, natural.w));
    setHStretch({ start: s, end: e });
  };
  const updateVStretchFromInputs = (start: number, end: number) => {
    const s = Math.max(0, Math.min(start, natural.h - 1));
    const e = Math.max(s + 1, Math.min(end, natural.h));
    setVStretch({ start: s, end: e });
  };
  const updatePadHFromInputs = (start: number, end: number) => {
    const s = Math.max(0, Math.min(start, natural.w - 1));
    const e = Math.max(s + 1, Math.min(end, natural.w));
    setPadH({ start: s, end: e });
  };
  const updatePadVFromInputs = (start: number, end: number) => {
    const s = Math.max(0, Math.min(start, natural.h - 1));
    const e = Math.max(s + 1, Math.min(end, natural.h));
    setPadV({ start: s, end: e });
  };
  const exportNineCompiled = async () => {
    if (!imgRef.current || !hStretch || !vStretch || !padH || !padV) {
      alert("Image or guides missing");
      return;
    }

    const img = imgRef.current;
    const iw = natural.w;
    const ih = natural.h;

    // Gambar image asli ke canvas (tanpa border)
    const c = document.createElement("canvas");
    c.width = iw;
    c.height = ih;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, iw, ih);
    ctx.drawImage(img, 0, 0, iw, ih);

    // Convert canvas ke PNG Buffer
    const blob = await new Promise<Blob | null>((resolve) =>
      c.toBlob((b) => resolve(b), "image/png")
    );
    if (!blob) return;

    const buf = Buffer.from(await blob.arrayBuffer());

    // Ekstrak chunk PNG
    const chunks: PNGChunk[] = extract(buf);

    // Buat chunk npTc
    const npTcChunk = createNinePatchChunk({
      stretch: {
        left: hStretch.start,
        right: iw - hStretch.end,
        top: vStretch.start,
        bottom: ih - vStretch.end,
      },
      padding: {
        left: padH.start,
        right: iw - padH.end,
        top: padV.start,
        bottom: ih - padV.end,
      },
    });

    const newPng = encode([
      ...chunks.filter((c: PNGChunk) => c.name !== "IEND"),
      npTcChunk,
      chunks.find((c: PNGChunk) => c.name === "IEND")!,
    ]);
    // Masukkan sebelum IEND

    // Simpan hasilnya
    const blobOut = new Blob([new Uint8Array(newPng).buffer], {
      type: "image/png",
    });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blobOut);

    let name = "image";
    try {
      name = (imageUrl || "").split("/").pop() || "image";
    } catch {}
    if (!name.endsWith(".9.png")) name = name.replace(/\.\w+$/, "") + ".9.png";

    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // === Helper untuk membuat chunk npTc ===
  function createNinePatchChunk({
    stretch,
    padding,
  }: {
    stretch: { left: number; right: number; top: number; bottom: number };
    padding: { left: number; right: number; top: number; bottom: number };
  }) {
    // Struktur biner chunk npTc Android
    const buf = Buffer.alloc(68);
    let offset = 0;

    const iw = natural.w;
    const ih = natural.h;

    // Header
    buf.writeInt32BE(1, offset); // wasDeserialized
    offset += 4;
    buf.writeInt32BE(2, offset); // xDiv count
    offset += 4;
    buf.writeInt32BE(2, offset); // yDiv count
    offset += 4;
    buf.writeInt32BE(9, offset); // color count
    offset += 4;

    // Padding area
    buf.writeInt32BE(padding.left, offset);
    buf.writeInt32BE(padding.right, offset + 4);
    buf.writeInt32BE(padding.top, offset + 8);
    buf.writeInt32BE(padding.bottom, offset + 12);
    offset += 16;

    // Stretch area
    buf.writeInt32BE(stretch.left, offset);
    buf.writeInt32BE(iw - stretch.right, offset + 4);
    buf.writeInt32BE(stretch.top, offset + 8);
    buf.writeInt32BE(ih - stretch.bottom, offset + 12);
    offset += 16;

    // Warna placeholder (9 segmen)
    buf.writeInt32BE(1, offset);
    buf.writeInt32BE(1, offset + 4);
    buf.writeInt32BE(1, offset + 8);
    buf.writeInt32BE(1, offset + 12);

    return { name: "npTc", data: buf };
  }
  // export .9.png
  const exportNine = () => {
    if (!imgRef.current || !hStretch || !vStretch || !padH || !padV) {
      alert("Image or guides missing");
      return;
    }
    const img = imgRef.current;
    const iw = natural.w;
    const ih = natural.h;

    const outW = iw + 2;
    const outH = ih + 2;
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext("2d")!;

    // transparent background (we want original image pixels)
    ctx.clearRect(0, 0, outW, outH);

    // draw original image at (1,1)
    ctx.drawImage(img, 1, 1, iw, ih);

    // top border: horizontal stretch region -> y = 0, x = start+1 .. end+1
    ctx.fillStyle = "black";
    const tStartX = hStretch.start + 1;
    const tEndX = hStretch.end + 1;
    ctx.fillRect(tStartX, 0, Math.max(1, tEndX - tStartX), 1);

    // left border: vertical stretch region -> x = 0, y = start+1 .. end+1
    const lStartY = vStretch.start + 1;
    const lEndY = vStretch.end + 1;
    ctx.fillRect(0, lStartY, 1, Math.max(1, lEndY - lStartY));

    // bottom border: content horizontal -> y = outH -1
    const cHStartX = padH.start + 1;
    const cHEndX = padH.end + 1;
    ctx.fillRect(cHStartX, outH - 1, Math.max(1, cHEndX - cHStartX), 1);

    // right border: content vertical -> x = outW -1
    const cVStartY = padV.start + 1;
    const cVEndY = padV.end + 1;
    ctx.fillRect(outW - 1, cVStartY, 1, Math.max(1, cVEndY - cVStartY));

    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      let name = "image";
      try {
        name = (imageUrl || "").split("/").pop() || "image";
      } catch {}
      if (!name.endsWith(".9.png"))
        name = name.replace(/\.\w+$/, "") + ".9.png";
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, "image/png");
  };

  // when numeric inputs change, update guides and redraw
  useEffect(() => {
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hStretch,
    vStretch,
    padH,
    padV,
    zoom,
    showPatch,
    showContent,
    scaleX,
    scaleY,
  ]);

  return (
    <div className="max-w-6xl mx-auto p-6 text-sm text-gray-100">
      <h2 className="text-xl font-semibold mb-4 text-white">
        9-Patch Editor — Advanced
      </h2>

      <div className="flex gap-6">
        {/* left: editor canvas */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              onClick={() => inputRef.current && inputRef.current.click()}
              className="px-3 py-1 bg-sky-600 rounded"
            >
              Upload PNG
            </button>

            <button
              onClick={exportNine}
              className="px-3 py-1 bg-emerald-600 rounded"
            >
              Export .9.png
            </button>
            <button
              onClick={exportNineCompiled}
              className="px-3 py-1 bg-emerald-600 rounded"
            >
              Export Compiled .9.png
            </button>
          </div>

          <div
            style={{
              width: maxEditorSize,
              height: maxEditorSize,
              border: "1px solid #374151",
              background: "white",
            }}
          >
            <canvas
              ref={canvasRef}
              width={maxEditorSize}
              height={maxEditorSize}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              style={{
                display: "block",
                cursor: dragging ? "grabbing" : "crosshair",
              }}
            />
          </div>

          <div className="mt-3 flex items-center gap-4">
            <label className="text-gray-300">Zoom:</label>
            <input
              type="range"
              min={0.1}
              max={3.8}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-64"
            />
            <span className="ml-2 text-gray-300">
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* right: controls + preview */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4">
            {/* Stretch inputs */}
            <div className="bg-neutral-800 p-3 rounded">
              <div className="font-semibold mb-2">Stretch (px) — absolute</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2">
                  Top (x start):{" "}
                  <input
                    type="number"
                    value={hStretch?.start ?? 0}
                    onChange={(e) =>
                      updateHStretchFromInputs(
                        parseInt(e.target.value || "0"),
                        hStretch?.end ?? natural.w
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Right (y end):{" "}
                  <input
                    type="number"
                    value={hStretch?.end ?? 0}
                    onChange={(e) =>
                      updateHStretchFromInputs(
                        hStretch?.start ?? 0,
                        parseInt(e.target.value || "0")
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>

                <label className="flex items-center gap-2">
                  Left (y start):{" "}
                  <input
                    type="number"
                    value={vStretch?.start ?? 0}
                    onChange={(e) =>
                      updateVStretchFromInputs(
                        parseInt(e.target.value || "0"),
                        vStretch?.end ?? natural.h
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Bottom (y end):{" "}
                  <input
                    type="number"
                    value={vStretch?.end ?? 0}
                    onChange={(e) =>
                      updateVStretchFromInputs(
                        vStretch?.start ?? 0,
                        parseInt(e.target.value || "0")
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>
              </div>
            </div>

            {/* Padding inputs */}
            <div className="bg-neutral-800 p-3 rounded">
              <div className="font-semibold mb-2">Padding / Content (px)</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2">
                  Left:{" "}
                  <input
                    type="number"
                    value={padH?.start ?? 0}
                    onChange={(e) =>
                      updatePadHFromInputs(
                        parseInt(e.target.value || "0"),
                        padH?.end ?? natural.w
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Right:{" "}
                  <input
                    type="number"
                    value={padH?.end ?? 0}
                    onChange={(e) =>
                      updatePadHFromInputs(
                        padH?.start ?? 0,
                        parseInt(e.target.value || "0")
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>

                <label className="flex items-center gap-2">
                  Top:{" "}
                  <input
                    type="number"
                    value={padV?.start ?? 0}
                    onChange={(e) =>
                      updatePadVFromInputs(
                        parseInt(e.target.value || "0"),
                        padV?.end ?? natural.h
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Bottom:{" "}
                  <input
                    type="number"
                    value={padV?.end ?? 0}
                    onChange={(e) =>
                      updatePadVFromInputs(
                        padV?.start ?? 0,
                        parseInt(e.target.value || "0")
                      )
                    }
                    className="ml-2 w-24 p-1 rounded bg-neutral-700"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* toggles */}
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPatch}
                onChange={(e) => setShowPatch(e.target.checked)}
              />
              Show Patch (green = stretch, red = padding)
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showContent}
                onChange={(e) => setShowContent(e.target.checked)}
              />
              Show Content
            </label>
          </div>

          {/* preview */}
          <div className="mt-4">
            <canvas ref={previewRef} style={{ border: "1px solid #374151" }} />
            <div className="mt-3 space-y-2">
              <div className="flex flex-col mt-3 w-full max-w-md">
                <label className="text-sm text-gray-300">
                  Zoom: {zoomPreview.toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="20"
                  max="300"
                  step="5"
                  value={zoomPreview}
                  onChange={(e) => setZoomPreview(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300">
                  Horizontal Stretch: {scaleX.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.1"
                  value={scaleX}
                  onChange={(e) => setScaleX(parseFloat(e.target.value))}
                  className="w-full accent-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300">
                  Vertical Stretch: {scaleY.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.1"
                  value={scaleY}
                  onChange={(e) => setScaleY(parseFloat(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
