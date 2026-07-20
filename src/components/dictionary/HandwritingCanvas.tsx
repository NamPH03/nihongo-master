// src/components/dictionary/HandwritingCanvas.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, X, Edit3 } from "lucide-react";

type Props = {
  onSelectWord: (word: string) => void;
  onClose: () => void;
};

export default function HandwritingCanvas({ onSelectWord, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Mảng lưu toạ độ các nét vẽ: [[[x1, y1, t1], [x2, y2, t2]], [[x1, y1, t1], ...]]
  const strokesRef = useRef<Array<Array<[number, number, number]>>>([[]]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      // Chỉ thiết lập lại kích thước buffer nếu kích thước thực tế thay đổi đáng kể
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        // Lưu lại nét vẽ cũ trước khi resize buffer (vì resize sẽ clear canvas)
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, 0);
        }

        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = "#1a1a1a"; // Màu đen đậm cố định trên nền trắng
          // Vẽ lại các nét vẽ cũ sau khi scale
          ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, rect.width, rect.height);
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const getCoordinates = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    // Tính toán tỉ lệ scale giữa kích thước hiển thị CSS (rect.width) và kích thước buffer nội bộ (canvas.width)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e.nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    // Thiết lập màu sắc và nét vẽ cố định
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#1a1a1a"; // Màu đen đậm cố định
    setIsDrawing(true);

    const time = Date.now();
    lastTimeRef.current = time;
    
    // Bắt đầu một nét vẽ mới
    if (strokesRef.current[strokesRef.current.length - 1].length > 0) {
      strokesRef.current.push([]);
    }
    strokesRef.current[strokesRef.current.length - 1].push([x, y, 0]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e.nativeEvent);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();

    const time = Date.now();
    const duration = time - lastTimeRef.current;
    strokesRef.current[strokesRef.current.length - 1].push([x, y, duration]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    recognizeHandwriting();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [[]];
    setCandidates([]);
  };

  // Gọi Google IME API để nhận diện chữ viết tay
  const recognizeHandwriting = async () => {
    // Chỉ nhận diện khi có nét vẽ thực tế
    const validStrokes = strokesRef.current.filter((stroke) => stroke.length > 0);
    if (validStrokes.length === 0) return;

    setLoading(true);

    // Định dạng dữ liệu gửi đi theo cấu trúc của Google API
    // ink: [[[x1,x2,...],[y1,y2,...],[t1,t2,...]], ...]
    const ink = validStrokes.map((stroke) => {
      const xs = stroke.map((pt) => Math.round(pt[0]));
      const ys = stroke.map((pt) => Math.round(pt[1]));
      const ts = stroke.map((pt) => pt[2]);
      return [xs, ys, ts];
    });

    const body = {
      app_version: 0.4,
      api_level: "533.0",
      device: "",
      input_type: 0,
      options: "enable_pre_space",
      requests: [
        {
          writing_area_width: canvasRef.current?.width || 300,
          writing_area_height: canvasRef.current?.height || 300,
          ink: ink,
          language: "ja",
        },
      ],
    };

    try {
      const response = await fetch("https://www.google.com.tw/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=utf-8", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("API error");

      const data = await response.json();
      if (data && data[0] === "SUCCESS") {
        const results = data[1][0][1] || [];
        setCandidates(results.slice(0, 10)); // Lấy tối đa 10 ứng cử viên hàng đầu
      }
    } catch (err) {
      console.error("Handwriting error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 flex flex-col gap-3 rounded-2xl border" style={{ borderColor: "var(--border-strong)" }}>
      <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          <Edit3 className="w-4 h-4" />
          Vẽ chữ Kanji để tra cứu
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative w-full max-w-[360px] mx-auto aspect-square rounded-xl overflow-hidden shadow-inner" style={{ background: "#ffffff", border: "1px dashed var(--border-strong)" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
        
        {loading && (
          <div className="absolute top-2 right-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
            Đang nhận diện...
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={clearCanvas}
          className="btn btn-ghost py-1.5 px-3 text-xs rounded-xl flex items-center gap-1"
        >
          <Eraser className="w-3.5 h-3.5" />
          Xóa bảng
        </button>
      </div>

      {/* Danh sách chữ nhận diện được */}
      <div className="flex flex-col gap-1.5 pt-2 border-t" style={{ borderColor: "var(--border-color)" }}>
        <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-faint)" }}>
          Kết quả dự đoán (chọn chữ để điền):
        </div>
        <div className="flex flex-wrap gap-1.5 min-h-[36px]">
          {candidates.length === 0 ? (
            <span className="text-xs italic py-1.5" style={{ color: "var(--text-faint)" }}>
              Hãy vẽ gì đó lên bảng...
            </span>
          ) : (
            candidates.map((char) => (
              <button
                key={char}
                onClick={() => onSelectWord(char)}
                className="font-jp text-lg font-bold w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                style={{ background: "var(--surface-3)", color: "var(--text)" }}
              >
                {char}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
