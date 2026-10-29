import { formatDate } from "@/lib/dates";
import type { InvoiceDocument } from "@/lib/documents";
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

// SPEC §8.3: asks the Customer to pay, at Sell prices. No adjustment lines.
export function InvoicePdf({
  document: invoice,
  letterhead,
}: {
  document: InvoiceDocument;
  letterhead: Letterhead;
}) {
  return (
    <DocumentPage
      letterhead={letterhead}
      title="Invoice"
      number={invoice.number}
      meta={[
        ["Invoice no.", invoice.number],
        ["Date", formatDate(invoice.date)],
        ["Order no.", invoice.orderNo],
        ["Challan no.", invoice.challanNo],
        ["Your ref.", invoice.customerRef],
      ]}
    >
      <Parties parties={[{ label: "Invoice to", recipient: invoice.to }]} />
      <ItemTable lines={invoice.lines} />
      <Totals
        quantity={invoice.totalQuantity}
        amount={invoice.total}
        amountLabel="Grand total"
      />
      <Note label="Note" text={invoice.note} />
      <Note
        label="Payment instructions"
        text={letterhead.paymentInstructions}
      />
      <Signatures>
        <CompanySignature
          letterhead={letterhead}
          label="Authorised signature"
        />
      </Signatures>
    </DocumentPage>
  );
}
