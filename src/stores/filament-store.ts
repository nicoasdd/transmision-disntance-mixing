"use client";

import { db } from "@/data/filament-db";
import { DEFAULT_FILAMENTS } from "@/data/default-filaments";
import type { FilamentProfile, FilamentExport } from "@/types/filament";

function generateId(): string {
  return `fil-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function initializeFilaments(): Promise<void> {
  const count = await db.filaments.count();
  if (count === 0) {
    await db.filaments.bulkAdd(DEFAULT_FILAMENTS);
  }
}

export async function getAllFilaments(): Promise<FilamentProfile[]> {
  return db.filaments.orderBy("name").toArray();
}

export async function getFilamentById(
  id: string
): Promise<FilamentProfile | undefined> {
  return db.filaments.get(id);
}

export async function createFilament(
  data: Omit<FilamentProfile, "id" | "isDefault" | "createdAt" | "updatedAt">
): Promise<FilamentProfile> {
  const now = new Date().toISOString();
  const filament: FilamentProfile = {
    ...data,
    id: generateId(),
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.filaments.add(filament);
  return filament;
}

export async function updateFilament(
  id: string,
  data: Partial<Omit<FilamentProfile, "id" | "isDefault" | "createdAt">>
): Promise<void> {
  await db.filaments.update(id, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteFilament(id: string): Promise<void> {
  const filament = await db.filaments.get(id);
  if (filament?.isDefault) {
    throw new Error("Cannot delete default filaments");
  }
  await db.filaments.delete(id);
}

export async function exportFilaments(): Promise<FilamentExport> {
  const filaments = await getAllFilaments();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    filaments: filaments.map((f) => ({
      name: f.name,
      brand: f.brand,
      material: f.material,
      colorHex: f.colorHex,
      td: f.td,
    })),
  };
}

export async function importFilaments(
  data: FilamentExport
): Promise<{ imported: number; skipped: number }> {
  if (!data.version || !Array.isArray(data.filaments)) {
    throw new Error("Invalid filament export file");
  }

  let imported = 0;
  let skipped = 0;

  for (const f of data.filaments) {
    if (!f.name || !f.colorHex || typeof f.td !== "number") {
      skipped++;
      continue;
    }

    const existing = await db.filaments
      .where("name")
      .equals(f.name)
      .first();

    if (existing) {
      skipped++;
      continue;
    }

    await createFilament({
      name: f.name,
      brand: f.brand || "Imported",
      material: f.material,
      colorHex: f.colorHex,
      td: f.td,
    });
    imported++;
  }

  return { imported, skipped };
}

export async function resetToDefaults(): Promise<void> {
  await db.filaments.clear();
  await db.filaments.bulkAdd(DEFAULT_FILAMENTS);
}
