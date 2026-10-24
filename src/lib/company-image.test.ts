import { describe, expect, it } from "vitest";
import { checkCompanyImage, MAX_IMAGE_BYTES } from "@/lib/company-image";
import { UserInputError } from "@/lib/errors";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunk(type: string, data: number[] = []): number[] {
  const length = data.length;
  return [
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...[...type].map((c) => c.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0, // CRC, not checked
  ];
}

// A PNG header with the given IHDR colour type, plus any extra chunks.
function png(colorType: number, extra: number[] = []): Uint8Array {
  const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, colorType, 0, 0, 0];
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...chunk("IHDR", ihdr),
    ...extra,
    ...chunk("IDAT", [0]),
    ...chunk("IEND"),
  ]);
}

const RGBA = 6;
const RGB = 2;
const PALETTE = 3;
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const svg = (text: string) => new TextEncoder().encode(text);

describe("checkCompanyImage for the logo", () => {
  it("accepts PNG, JPG and SVG", () => {
    expect(checkCompanyImage("logo", png(RGB))).toEqual({
      contentType: "image/png",
      extension: "png",
    });
    expect(checkCompanyImage("logo", jpeg)).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(
      checkCompanyImage(
        "logo",
        svg('<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="x"></svg>'),
      ),
    ).toEqual({ contentType: "image/svg+xml", extension: "svg" });
  });

  it("refuses anything else, whatever its name", () => {
    expect(() =>
      checkCompanyImage("logo", svg("<html><svg></svg></html>")),
    ).toThrow(new UserInputError("Upload the logo as a PNG, JPG or SVG."));
    expect(() => checkCompanyImage("logo", new Uint8Array())).toThrow(
      UserInputError,
    );
  });

  it("refuses a file over 1 MB", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(jpeg);
    expect(() => checkCompanyImage("logo", big)).toThrow(
      new UserInputError("The image must be 1 MB or smaller."),
    );
  });
});

describe("checkCompanyImage for the signature", () => {
  it("accepts a PNG with transparency", () => {
    expect(checkCompanyImage("signature", png(RGBA))).toEqual({
      contentType: "image/png",
      extension: "png",
    });
    expect(
      checkCompanyImage("signature", png(PALETTE, chunk("tRNS", [0]))),
    ).toMatchObject({ contentType: "image/png" });
  });

  it("refuses a PNG without transparency", () => {
    expect(() => checkCompanyImage("signature", png(RGB))).toThrow(
      new UserInputError(
        "The signature needs a transparent background: save it as a PNG with transparency.",
      ),
    );
  });

  it("refuses JPG and SVG", () => {
    for (const file of [jpeg, svg("<svg></svg>")]) {
      expect(() => checkCompanyImage("signature", file)).toThrow(
        new UserInputError("Upload the signature as a PNG."),
      );
    }
  });
});
