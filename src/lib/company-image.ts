import { UserInputError } from "@/lib/errors";

// The logo and signature printed on every document (SPEC §12). The file's
// own bytes decide its type, never its name or the browser's claim.

export const COMPANY_IMAGE_KINDS = ["logo", "signature"] as const;

export type CompanyImageKind = (typeof COMPANY_IMAGE_KINDS)[number];

export function isCompanyImageKind(value: string): value is CompanyImageKind {
  return (COMPANY_IMAGE_KINDS as readonly string[]).includes(value);
}

export type CompanyImageType = {
  contentType: "image/png" | "image/jpeg" | "image/svg+xml";
  extension: "png" | "jpg" | "svg";
};

// Matches the company-assets bucket's limit.
export const MAX_IMAGE_BYTES = 1024 * 1024;

const PNG: CompanyImageType = { contentType: "image/png", extension: "png" };
const JPEG: CompanyImageType = { contentType: "image/jpeg", extension: "jpg" };
const SVG: CompanyImageType = {
  contentType: "image/svg+xml",
  extension: "svg",
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// An optional XML declaration, comments and doctype, then the <svg> root.
const SVG_ROOT =
  /^\uFEFF?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i;

export function checkCompanyImage(
  kind: CompanyImageKind,
  bytes: Uint8Array,
): CompanyImageType {
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new UserInputError("The image must be 1 MB or smaller.");
  }
  const type = detect(bytes);

  if (kind === "logo") {
    if (!type)
      throw new UserInputError("Upload the logo as a PNG, JPG or SVG.");
    return type;
  }
  if (type !== PNG) throw new UserInputError("Upload the signature as a PNG.");
  if (!hasTransparency(bytes)) {
    throw new UserInputError(
      "The signature needs a transparent background: save it as a PNG with transparency.",
    );
  }
  return PNG;
}

function detect(bytes: Uint8Array): CompanyImageType | undefined {
  if (PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) return PNG;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return JPEG;
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  if (SVG_ROOT.test(head)) return SVG;
  return undefined;
}

// A grey+alpha or RGBA colour type, or a tRNS chunk before the image data.
function hasTransparency(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const colorType = bytes[25];
  if (colorType === 4 || colorType === 6) return true;

  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "tRNS") return true;
    if (type === "IDAT" || type === "IEND") return false;
    offset += 12 + length;
  }
  return false;
}
