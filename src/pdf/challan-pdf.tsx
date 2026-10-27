import { formatDate } from "@/lib/dates";
import type { ChallanDocument } from "@/lib/documents";
import {
  CompanySignature,
  DocumentPage,
  ItemTable,
  Parties,
  ReceiverSignature,
  Signatures,
  Totals,
} from "@/pdf/components";
import type { Letterhead } from "@/pdf/letterhead";

// SPEC §8.2: goes to the Customer with the goods. Quantities only.
export function ChallanPdf({
  document: challan,
  letterhead,
}: {
  document: ChallanDocument;
  letterhead: Letterhead;
}) {
  return (
    <DocumentPage
      letterhead={letterhead}
      title="Delivery Challan"
      number={challan.number}
      meta={[
        ["Challan no.", challan.number],
        ["Date", formatDate(challan.date)],
        ["Order no.", challan.orderNo],
        ["Your ref.", challan.customerRef],
      ]}
    >
      <Parties parties={[{ label: "To", recipient: challan.to }]} />
      <ItemTable lines={challan.lines} />
      <Totals quantity={challan.totalQuantity} />
      <Signatures>
        <ReceiverSignature />
        <CompanySignature letterhead={letterhead} label="Delivered by" />
      </Signatures>
    </DocumentPage>
  );
}
