"use client";

import { useState, useEffect, useCallback } from "react";
import type { FilamentProfile } from "@/types/filament";
import {
  getAllFilaments,
  initializeFilaments,
} from "@/stores/filament-store";

interface FilamentStackEditorProps {
  stack: FilamentProfile[];
  onChange: (stack: FilamentProfile[]) => void;
  maxSlots?: number;
}

export function FilamentStackEditor({
  stack,
  onChange,
  maxSlots = 8,
}: FilamentStackEditorProps) {
  const [available, setAvailable] = useState<FilamentProfile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    initializeFilaments().then(() => getAllFilaments().then(setAvailable));
  }, []);

  const addFilament = useCallback(
    (f: FilamentProfile) => {
      if (stack.length < maxSlots) {
        onChange([...stack, f]);
      }
      setShowPicker(false);
    },
    [stack, onChange, maxSlots]
  );

  const removeFilament = useCallback(
    (idx: number) => {
      onChange(stack.filter((_, i) => i !== idx));
    },
    [stack, onChange]
  );

  const moveFilament = useCallback(
    (fromIdx: number, toIdx: number) => {
      const next = [...stack];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      onChange(next);
    },
    [stack, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Filament Stack ({stack.length}/{maxSlots})
        </label>
        {stack.length < maxSlots && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {stack.length === 0 && (
        <p className="text-xs text-gray-400">
          Add at least 2 filaments to begin. Bottom layer first.
        </p>
      )}

      <div className="space-y-1">
        {stack.map((f, idx) => (
          <div
            key={`${f.id}-${idx}`}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIdx !== null && dragIdx !== idx) {
                moveFilament(dragIdx, idx);
              }
              setDragIdx(null);
            }}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors cursor-grab active:cursor-grabbing ${
              dragIdx === idx
                ? "border-blue-300 bg-blue-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <span className="text-xs text-gray-400 w-5">
              {idx === stack.length - 1 ? "TOP" : idx === 0 ? "BTM" : idx + 1}
            </span>
            <span
              className="h-5 w-5 rounded-full border border-gray-300 shrink-0"
              style={{ backgroundColor: f.colorHex }}
            />
            <span className="flex-1 truncate font-medium">{f.name}</span>
            <span className="text-xs text-gray-400">
              TD {f.td.toFixed(1)}
            </span>
            <button
              onClick={() => removeFilament(idx)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showPicker && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {available.map((f) => (
            <button
              key={f.id}
              onClick={() => addFilament(f)}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <span
                className="h-4 w-4 rounded-full border border-gray-300 shrink-0"
                style={{ backgroundColor: f.colorHex }}
              />
              <span className="flex-1 text-left truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{f.brand}</span>
              <span className="text-xs text-gray-400">TD {f.td.toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
