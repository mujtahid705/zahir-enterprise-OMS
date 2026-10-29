import { db, type Db, type Tx } from "@/db/client";
import type { CurrentUser } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { buildDocument, type DocumentRef } from "@/lib/documents";
import { defaultLogo, printableImage, type Letterhead } from "@/pdf/letterhead";
import { renderDocumentPdf } from "@/pdf/render";
import {
  getLetterheadSettings,
  type AssetStorage,
} from "@/services/company-settings";
import { authorize } from "@/services/master-data";
import { orders } from "@/services/orders";

// An Order's Work Orders, Challan and Invoice as PDFs (SPEC §8). Rendering
// alone changes nothing and logs nothing: it serves Preview and the file
// Share sends (SPEC §13.2 GET).

type Deps = { executor?: Db | Tx; storage: AssetStorage };

// Company settings with their images ready to print (SPEC §12).
async function letterhead(
  executor: Db | Tx,
  storage: AssetStorage,
): Promise<Letterhead> {
  const settings = await getLetterheadSettings({ executor });
  const image = async (path: string | null | undefined) => {
    const file = path ? await storage.download(path) : null;
    return file ? printableImage(file.bytes, file.contentType) : null;
  };
  const [logo, signature] = await Promise.all([
    image(settings?.logoPath),
    image(settings?.signaturePath),
  ]);
  return {
    name: settings?.name ?? "Zahir Enterprise",
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    logo: logo ?? (await defaultLogo()),
    signature,
    paymentInstructions: settings?.paymentInstructions ?? null,
  };
}

// The PDF and its file name, or undefined if the Order (or the Work Order
// on it) doesn't exist. `date` overrides the document's stored date.
async function render(
  actor: CurrentUser,
  orderId: string,
  ref: DocumentRef,
  { executor = db, storage, date }: Deps & { date?: string },
): Promise<{ fileName: string; pdf: Buffer } | undefined> {
  authorize(actor, "shareDocuments");
  const order = await orders.get(actor, orderId, { executor });
  if (!order) return undefined;
  const built = buildDocument(order, ref, { today: todayInDhaka(), date });
  if (!built) return undefined;
  const pdf = await renderDocumentPdf(
    built.document,
    await letterhead(executor, storage),
  );
  return { fileName: built.fileName, pdf };
}

export const documents = { render };
