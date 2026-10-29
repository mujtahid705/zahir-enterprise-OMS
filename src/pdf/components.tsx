import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { DocumentLine, PricedLine, Recipient } from "@/lib/documents";
import { amountInWords, formatMoney, formatPieces } from "@/lib/money";
import type { Letterhead } from "@/pdf/letterhead";

// The parts every document shares (DESIGN §10): letterhead, title and meta
// block, item table, totals and signature. Navy only, built for printing
// and black-and-white copies.

// DESIGN §1 tokens. A PDF can't read the app's CSS variables.
const COLOR = {
  navy: "#081F3F",
  ink: "#0E1A2B",
  inkMuted: "#5B6472",
  inkSubtle: "#8A929E",
  border: "#E5E5E0",
  tableHeader: "#F1F1EE",
};

const FONTS = path.join(process.cwd(), "src/pdf/fonts");

Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONTS, "Geist-SemiBold.ttf"), fontWeight: 600 },
    {
      src: path.join(FONTS, "Geist-Italic.ttf"),
      fontWeight: 400,
      fontStyle: "italic",
    },
  ],
});
// Product names and addresses never break mid-word.
Font.registerHyphenationCallback((word) => [word]);

const MM = 72 / 25.4;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 9.5,
    color: COLOR.ink,
    paddingTop: 16 * MM,
    paddingBottom: 20 * MM,
    paddingHorizontal: 16 * MM,
  },
  letterhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4 * MM,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.navy,
  },
  logo: { width: 40 * MM, maxHeight: 22 * MM, objectFit: "contain" },
  company: {
    maxWidth: "55%",
    alignItems: "flex-end",
    fontSize: 9,
    color: COLOR.inkMuted,
    textAlign: "right",
  },
  companyName: { fontWeight: 600, color: COLOR.navy },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 7 * MM,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 16 * 0.15,
    color: COLOR.navy,
    textTransform: "uppercase",
  },
  meta: { minWidth: "40%" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end" },
  metaLabel: { color: COLOR.inkMuted, width: 30 * MM, textAlign: "right" },
  metaValue: { marginLeft: 3 * MM, minWidth: 30 * MM, fontWeight: 500 },
  parties: { flexDirection: "row", gap: 8 * MM, marginTop: 6 * MM },
  party: { flex: 1 },
  label: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 8 * 0.12,
    textTransform: "uppercase",
    color: COLOR.inkMuted,
    marginBottom: 1 * MM,
  },
  partyName: { fontWeight: 600, color: COLOR.navy },
  table: { marginTop: 7 * MM },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
    paddingVertical: 2 * MM,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: COLOR.tableHeader,
    paddingVertical: 1.5 * MM,
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 8 * 0.12,
    textTransform: "uppercase",
    color: COLOR.inkMuted,
  },
  cellIndex: { width: 8 * MM, paddingLeft: 2 * MM },
  cellProduct: { flex: 1, paddingRight: 3 * MM },
  cellNumber: {
    width: 30 * MM,
    paddingRight: 2 * MM,
    textAlign: "right",
    fontFeatureSettings: ["tnum"],
  },
  spec: { color: COLOR.inkMuted, fontSize: 8.5 },
  totals: {
    marginTop: 4 * MM,
    marginLeft: "auto",
    width: "50%",
    borderTopWidth: 1,
    borderTopColor: COLOR.navy,
    paddingTop: 2 * MM,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 0.75 * MM,
  },
  totalValue: { fontWeight: 600, fontFeatureSettings: ["tnum"] },
  grandTotal: { fontWeight: 600, color: COLOR.navy },
  words: {
    marginTop: 2 * MM,
    fontSize: 9,
    fontStyle: "italic",
    textAlign: "right",
  },
  section: { marginTop: 6 * MM },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12 * MM,
    marginTop: 14 * MM,
  },
  signature: { width: 62 * MM },
  signatureImage: { height: 14 * MM, objectFit: "contain", objectPosition: 0 },
  signatureSpace: { height: 14 * MM },
  signatureRule: {
    borderTopWidth: 0.5,
    borderTopColor: COLOR.ink,
    paddingTop: 1 * MM,
  },
  blankLine: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 6 * MM,
    color: COLOR.inkMuted,
  },
  blankRule: {
    flex: 1,
    marginLeft: 2 * MM,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.inkSubtle,
  },
  footer: {
    position: "absolute",
    bottom: 10 * MM,
    left: 16 * MM,
    right: 16 * MM,
    fontSize: 8,
    color: COLOR.inkSubtle,
    textAlign: "center",
  },
});

export function DocumentPage({
  letterhead,
  title,
  number,
  meta,
  children,
}: {
  letterhead: Letterhead;
  title: string;
  number: string;
  meta: [string, string | null][];
  children: ReactNode;
}) {
  const contact = [letterhead.phone, letterhead.email].filter(Boolean);
  return (
    <Document title={`${title} ${number}`} author={letterhead.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt */}
          <Image style={styles.logo} src={letterhead.logo} />
          <View style={styles.company}>
            <Text style={styles.companyName}>{letterhead.name}</Text>
            {letterhead.address && <Text>{letterhead.address}</Text>}
            {contact.length > 0 && <Text>{contact.join(" · ")}</Text>}
          </View>
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.meta}>
            {meta
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <View key={label} style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{label}</Text>
                  <Text style={styles.metaValue}>{value}</Text>
                </View>
              ))}
          </View>
        </View>

        {children}

        {/* Any lineHeight on this text makes react-pdf drop it. */}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ""
          }
        />
      </Page>
    </Document>
  );
}

export function Parties({
  parties,
}: {
  parties: { label: string; recipient: Recipient }[];
}) {
  return (
    <View style={styles.parties}>
      {parties.map(({ label, recipient }) => (
        <View key={label} style={styles.party}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.partyName}>{recipient.name}</Text>
          {recipient.address && <Text>{recipient.address}</Text>}
          {recipient.phone && <Text>{recipient.phone}</Text>}
        </View>
      ))}
    </View>
  );
}

// Lines at a price (Work Order: Buy, Invoice: Sell), or without one
// (Challan).
export function ItemTable({
  lines,
}: {
  lines: readonly (DocumentLine | PricedLine)[];
}) {
  const priced = lines.some((line) => "price" in line);
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.cellIndex]}>#</Text>
        <Text style={[styles.headerCell, styles.cellProduct]}>Product</Text>
        <Text style={[styles.headerCell, styles.cellNumber]}>Quantity</Text>
        {priced && (
          <>
            <Text style={[styles.headerCell, styles.cellNumber]}>
              Price / pc
            </Text>
            <Text style={[styles.headerCell, styles.cellNumber]}>Total</Text>
          </>
        )}
      </View>
      {lines.map((line, index) => (
        <View key={index} style={styles.row} wrap={false}>
          <Text style={styles.cellIndex}>{index + 1}</Text>
          <View style={styles.cellProduct}>
            <Text>{line.productName}</Text>
            {line.specText && <Text style={styles.spec}>{line.specText}</Text>}
          </View>
          <Text style={styles.cellNumber}>{formatPieces(line.quantity)}</Text>
          {"price" in line && (
            <>
              <Text style={styles.cellNumber}>{formatMoney(line.price)}</Text>
              <Text style={styles.cellNumber}>{formatMoney(line.total)}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

// Total quantity, then the amount and its words when the document has one.
export function Totals({
  quantity,
  amount,
  amountLabel = "Total amount",
}: {
  quantity: number;
  amount?: string;
  amountLabel?: string;
}) {
  return (
    <View wrap={false}>
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text>Total quantity</Text>
          <Text style={styles.totalValue}>{formatPieces(quantity)}</Text>
        </View>
        {amount !== undefined && (
          <View style={styles.totalRow}>
            <Text style={styles.grandTotal}>{amountLabel}</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>
              {formatMoney(amount)}
            </Text>
          </View>
        )}
      </View>
      {amount !== undefined && (
        <Text style={styles.words}>{amountInWords(amount)}</Text>
      )}
    </View>
  );
}

// A labelled block of free text (notes, payment instructions).
export function Note({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      <Text>{text}</Text>
    </View>
  );
}

export function Signatures({ children }: { children: ReactNode }) {
  return (
    <View style={styles.signatures} wrap={false}>
      {children}
    </View>
  );
}

// ZE's signature: the image from Settings above the rule, if there is one.
export function CompanySignature({
  letterhead,
  label,
}: {
  letterhead: Letterhead;
  label: string;
}) {
  return (
    <View style={[styles.signature, { marginLeft: "auto" }]}>
      {letterhead.signature ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- a PDF image has no alt
        <Image style={styles.signatureImage} src={letterhead.signature} />
      ) : (
        <View style={styles.signatureSpace} />
      )}
      <Text style={styles.signatureRule}>
        {label} — {letterhead.name}
      </Text>
    </View>
  );
}

// The Customer signs on delivery (SPEC §8.2): blank name and date lines.
export function ReceiverSignature() {
  return (
    <View style={styles.signature}>
      <View style={styles.signatureSpace} />
      <Text style={styles.signatureRule}>Received by (customer)</Text>
      {["Name", "Date"].map((label) => (
        <View key={label} style={styles.blankLine}>
          <Text>{label}</Text>
          <View style={styles.blankRule} />
        </View>
      ))}
    </View>
  );
}
