import Dexie, { type EntityTable } from "dexie";
import type { FilamentProfile } from "@/types/filament";

const DB_NAME = "td-color-mixing";
const DB_VERSION = 1;

class FilamentDatabase extends Dexie {
  filaments!: EntityTable<FilamentProfile, "id">;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      filaments: "id, name, brand, isDefault, createdAt",
    });
  }
}

export const db = new FilamentDatabase();
