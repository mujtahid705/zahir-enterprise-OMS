import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// What every document prints about ZE (SPEC §8, §12), from company
// settings. react-pdf draws only PNG and JPEG, so an SVG logo is rasterised
// first.

export type PdfImage = { data: Buffer; format: "png" | "jpg" };

export type Letterhead = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: PdfImage;
  signature: PdfImage | null;
  paymentInstructions: string | null;
};

// Read from disk at runtime; next.config.ts traces it into the document
// routes.
const DEFAULT_LOGO = path.join(process.cwd(), "brand/ze-logo-navy.svg");

// Wide enough for a sharp ≈40mm logo at print resolution.
const SVG_RASTER_WIDTH_PX = 1200;

export async function printableImage(
  bytes: Uint8Array,
  contentType: string,
): Promise<PdfImage> {
  if (contentType === "image/jpeg")
    return { data: Buffer.from(bytes), format: "jpg" };
  if (contentType === "image/png")
    return { data: Buffer.from(bytes), format: "png" };
  const data = await sharp(bytes, { density: 300 })
    .resize({ width: SVG_RASTER_WIDTH_PX })
    .png()
    .toBuffer();
  return { data, format: "png" };
}

// The navy ZE logo, used until an Admin uploads one (SPEC §12).
export async function defaultLogo(): Promise<PdfImage> {
  return printableImage(await readFile(DEFAULT_LOGO), "image/svg+xml");
}
