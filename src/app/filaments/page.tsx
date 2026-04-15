"use client";

import { useState, useEffect, useCallback } from "react";
import type { FilamentProfile } from "@/types/filament";
import {
  getAllFilaments,
  initializeFilaments,
  createFilament,
  updateFilament,
  deleteFilament,
} from "@/stores/filament-store";
import { FilamentForm, type FilamentFormData } from "@/components/filament-form";
import { FilamentImportExport } from "@/components/filament-import-export";

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<FilamentProfile[]>([]);
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FilamentProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadFilaments = useCallback(async () => {
    await initializeFilaments();
    const all = await getAllFilaments();
    setFilaments(all);
  }, []);

  useEffect(() => {
    loadFilaments();
  }, [loadFilaments]);

  const filtered = filaments.filter((f) => {
    const matchesSearch =
      !search ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.brand.toLowerCase().includes(search.toLowerCase());
    const matchesMaterial =
      materialFilter === "All" || f.material === materialFilter;
    return matchesSearch && matchesMaterial;
  });

  const materials = Array.from(
    new Set(filaments.map((f) => f.material).filter(Boolean))
  );

  const handleAdd = async (data: FilamentFormData) => {
    await createFilament(data);
    await loadFilaments();
    setShowForm(false);
  };

  const handleEdit = async (data: FilamentFormData) => {
    if (!editing) return;
    await updateFilament(editing.id, data);
    await loadFilaments();
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFilament(id);
      await loadFilaments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Filament Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            {filaments.length} filaments • {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FilamentImportExport onImportComplete={loadFilaments} />
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Add Filament
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or brand..."
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="All">All Materials</option>
          {materials.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Filament table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Color
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Brand
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Material
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                TD
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span
                    className="inline-block h-6 w-6 rounded-full border border-gray-200"
                    style={{ backgroundColor: f.colorHex }}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium">{f.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{f.brand}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {f.material ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm font-mono">{f.td.toFixed(1)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(f)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    {!f.isDefault && (
                      <>
                        {confirmDelete === f.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="text-xs text-red-600 font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(f.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No filaments match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showForm && (
        <FilamentForm
          title="Add Filament"
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <FilamentForm
          title="Edit Filament"
          initial={{
            name: editing.name,
            brand: editing.brand,
            material: editing.material ?? "PLA",
            colorHex: editing.colorHex,
            td: editing.td,
          }}
          onSave={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
