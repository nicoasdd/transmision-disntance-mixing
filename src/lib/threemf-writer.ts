/**
 * 3MF file writer.
 * Assembles multi-material 3MF packages conforming to 3MF Core Spec + Materials Extension.
 * Uses multi-body via basematerials for BambuStudio compatibility.
 * Generates XML incrementally to minimize peak memory.
 */

import JSZip from "jszip";
import type {
  BaseMaterial,
  MeshObject,
  ThreeMFPackage,
} from "@/types/threemf";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const MODEL_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
const MAT_NS = "http://schemas.microsoft.com/3dmanufacturing/material/2015/02";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function buildContentTypes(): string {
  return (
    XML_HEADER +
    `<Types xmlns="${CT_NS}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
    "</Types>"
  );
}

function buildRelationships(): string {
  return (
    XML_HEADER +
    `<Relationships xmlns="${REL_NS}">` +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
    "</Relationships>"
  );
}

/**
 * Build the 3D model XML as an array of string chunks.
 * Avoids creating one massive string — chunks are fed directly to JSZip.
 */
function buildModelChunks(pkg: ThreeMFPackage): string[] {
  const chunks: string[] = [];

  // Header
  chunks.push(
    XML_HEADER,
    `<model unit="millimeter" xml:lang="en-US" xmlns="${MODEL_NS}" xmlns:m="${MAT_NS}">`,
    '<metadata name="Application">TD Color Mixing Generator</metadata>'
  );

  for (const [key, value] of Object.entries(pkg.metadata)) {
    chunks.push(`<metadata name="${escapeXml(key)}">${escapeXml(value)}</metadata>`);
  }

  chunks.push("<resources>");

  // Materials
  chunks.push('<basematerials id="1">');
  for (const m of pkg.materials) {
    chunks.push(`<base name="${escapeXml(m.name)}" displaycolor="${m.displayColor}"/>`);
  }
  chunks.push("</basematerials>");

  // Objects — vertex/triangle data streamed per object
  for (const obj of pkg.objects) {
    chunks.push(
      `<object id="${obj.id}" type="model" name="${escapeXml(obj.name)}" pid="1" pindex="${obj.materialIndex}">`
    );
    chunks.push("<mesh><vertices>");

    // Write vertices in batches to limit per-chunk size
    const BATCH = 5000;
    for (let i = 0; i < obj.vertices.length; i += BATCH) {
      let batch = "";
      const end = Math.min(i + BATCH, obj.vertices.length);
      for (let j = i; j < end; j++) {
        const v = obj.vertices[j];
        batch += `<vertex x="${v[0].toFixed(4)}" y="${v[1].toFixed(4)}" z="${v[2].toFixed(4)}"/>`;
      }
      chunks.push(batch);
    }

    chunks.push("</vertices><triangles>");

    for (let i = 0; i < obj.triangles.length; i += BATCH) {
      let batch = "";
      const end = Math.min(i + BATCH, obj.triangles.length);
      for (let j = i; j < end; j++) {
        const t = obj.triangles[j];
        batch += `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}" pid="1" p1="${obj.materialIndex}"/>`;
      }
      chunks.push(batch);
    }

    chunks.push("</triangles></mesh></object>");
  }

  chunks.push("</resources>");

  // Build items
  chunks.push("<build>");
  for (const obj of pkg.objects) {
    chunks.push(`<item objectid="${obj.id}"/>`);
  }
  chunks.push("</build></model>");

  return chunks;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Assemble a complete 3MF ZIP package from model data.
 */
export async function assemble3MF(pkg: ThreeMFPackage): Promise<Blob> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", buildContentTypes());
  zip.file("_rels/.rels", buildRelationships());

  // Join chunks into final XML — still needed as JSZip expects a single string/blob
  const modelXml = buildModelChunks(pkg).join("\n");
  zip.file("3D/3dmodel.model", modelXml);

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Create a ThreeMFPackage from layer meshes and filament info.
 */
export function buildPackage(
  meshObjects: MeshObject[],
  materials: BaseMaterial[],
  metadata?: Record<string, string>
): ThreeMFPackage {
  return {
    materials,
    objects: meshObjects,
    buildItems: meshObjects.map((obj) => ({
      objectId: obj.id,
      transform: null,
    })),
    metadata: metadata ?? {},
  };
}
