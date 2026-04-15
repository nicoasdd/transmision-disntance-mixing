"use client";

import { useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  exportFilaments,
  importFilaments,
} from "@/stores/filament-store";

interface FilamentImportExportProps {
  onImportComplete: () => void;
}

export function FilamentImportExport({ onImportComplete }: FilamentImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const data = await exportFilaments();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      saveAs(blob, `filaments-${new Date().toISOString().slice(0, 10)}.json`);
      setStatus("Exported successfully!");
    } catch {
      setStatus("Export failed.");
    }
    setTimeout(() => setStatus(null), 3000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await importFilaments(data);
      setStatus(`Imported ${result.imported}, skipped ${result.skipped}`);
      onImportComplete();
    } catch {
      setStatus("Invalid import file.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setStatus(null), 4000);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleExport}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Export Library
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Import Library
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
      {status && (
        <span className="text-xs text-gray-500">{status}</span>
      )}
    </div>
  );
}
