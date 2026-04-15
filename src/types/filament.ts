export interface FilamentProfile {
  id: string;
  name: string;
  brand: string;
  material?: string;
  colorHex: string;
  td: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilamentExport {
  version: number;
  exportedAt: string;
  filaments: {
    name: string;
    brand: string;
    material?: string;
    colorHex: string;
    td: number;
  }[];
}
