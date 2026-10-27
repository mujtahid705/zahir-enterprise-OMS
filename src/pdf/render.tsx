import { renderToBuffer } from "@react-pdf/renderer";
import type { OrderDocument } from "@/lib/documents";
import { ChallanPdf } from "@/pdf/challan-pdf";
import { InvoicePdf } from "@/pdf/invoice-pdf";
import type { Letterhead } from "@/pdf/letterhead";
import { WorkOrderPdf } from "@/pdf/work-order-pdf";

// An Order's document as A4 PDF bytes (SPEC §8).
export function renderDocumentPdf(
  document: OrderDocument,
  letterhead: Letterhead,
): Promise<Buffer> {
  switch (document.type) {
    case "work_order":
      return renderToBuffer(
        <WorkOrderPdf document={document} letterhead={letterhead} />,
      );
    case "challan":
      return renderToBuffer(
        <ChallanPdf document={document} letterhead={letterhead} />,
      );
    case "invoice":
      return renderToBuffer(
        <InvoicePdf document={document} letterhead={letterhead} />,
      );
  }
}
