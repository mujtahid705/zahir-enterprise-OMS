import { formatDate } from "@/lib/dates";
import type { WorkOrderDocument } from "@/lib/documents";
import {
  CompanySignature,
  DocumentPage,
  ItemTable,
  Note,
  Parties,
  Signatures,
  Totals,
} from "@/pdf/components";
import type { Letterhead } from "@/pdf/letterhead";

// SPEC §8.1: to the Supplier, at Buy prices. Goods come to ZE.
export function WorkOrderPdf({
  document: wo,
  letterhead,
}: {
  document: WorkOrderDocument;
  letterhead: Letterhead;
}) {
  return (
    <DocumentPage
      letterhead={letterhead}
      title="Work Order"
      number={wo.number}
      meta={[
        ["WO no.", wo.number],
        ["Date", formatDate(wo.date)],
        ["Required by", wo.requiredBy && formatDate(wo.requiredBy)],
      ]}
    >
      <Parties
        parties={[
          { label: "To", recipient: wo.to },
          {
            label: "Deliver to",
            recipient: {
              name: letterhead.name,
              address: letterhead.address ?? "",
              phone: letterhead.phone ?? "",
            },
          },
        ]}
      />
      <ItemTable lines={wo.lines} />
      <Totals quantity={wo.totalQuantity} amount={wo.total} />
      <Note label="Notes / instructions" text={wo.note} />
      <Signatures>
        <CompanySignature
          letterhead={letterhead}
          label="Authorised signature"
        />
      </Signatures>
    </DocumentPage>
  );
}
