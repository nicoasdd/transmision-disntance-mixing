"use client";

import { useState, useCallback, useRef } from "react";

interface ImageUploaderProps {
  onImageLoad: (data: {
    imageBitmap: ImageBitmap;
    width: number;
    height: number;
    objectUrl: string;
  }) => void;
  currentImageUrl: string | null;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_DIMENSION = 4096;

export function ImageUploader({ onImageLoad, currentImageUrl }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Only JPEG and PNG images are supported.");
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const bitmap = await createImageBitmap(file);
        let finalBitmap = bitmap;

        if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(bitmap.width, bitmap.height);
          const newW = Math.round(bitmap.width * scale);
          const newH = Math.round(bitmap.height * scale);
          finalBitmap = await createImageBitmap(file, {
            resizeWidth: newW,
            resizeHeight: newH,
          });
          bitmap.close();
        }

        const objectUrl = URL.createObjectURL(file);

        onImageLoad({
          imageBitmap: finalBitmap,
          width: finalBitmap.width,
          height: finalBitmap.height,
          objectUrl,
        });
      } catch {
        setError("Failed to decode image. Please try a different file.");
      } finally {
        setLoading(false);
      }
    },
    [onImageLoad]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">Source Image</label>

      {currentImageUrl ? (
        <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
          <img
            src={currentImageUrl}
            alt="Source"
            className="w-full max-h-80 object-contain"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 rounded bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow hover:bg-white transition-colors"
          >
            Change Image
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400"
          }`}
        >
          {loading ? (
            <div className="text-sm text-gray-500">Processing image...</div>
          ) : (
            <>
              <svg
                className="mb-3 h-10 w-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-600">
                Drag & drop an image or{" "}
                <span className="font-medium text-blue-600">browse</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">JPEG or PNG, max 4096px</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
