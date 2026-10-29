// Money in BDT (SPEC §8): `Tk` and lakh/crore digit grouping, everywhere in
// the app and on documents. Amounts arrive as Postgres numeric strings.

const TAKA = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: string | number): string {
  const value = Number(amount);
  return `${value < 0 ? "-" : ""}Tk ${TAKA.format(Math.abs(value))}`;
}

const PIECES = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// Quantities share the grouping (SPEC §8): "1,20,000 pcs".
export function formatPieces(quantity: number): string {
  return `${PIECES.format(quantity)} pcs`;
}

const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

// 1–99: "Twenty-Five".
function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const ones = n % 10;
  return TENS[Math.floor(n / 10)]! + (ones ? `-${ONES[ones]}` : "");
}

// Indian places: crore (1,00,00,000), lakh (1,00,000), thousand, hundred.
// The crore count itself may run past 99, so it is spelt out the same way.
const PLACES: [number, string][] = [
  [10_000_000, "Crore"],
  [100_000, "Lakh"],
  [1_000, "Thousand"],
  [100, "Hundred"],
];

function inWords(n: number): string {
  const words: string[] = [];
  for (const [size, name] of PLACES) {
    const count = Math.floor(n / size);
    if (count) words.push(`${inWords(count)} ${name}`);
    n %= size;
  }
  if (n) words.push(belowHundred(n));
  return words.join(" ");
}

// The Invoice and Work Order total in words (SPEC §8.3), lakh/crore:
// "Taka One Lakh Twenty-Five Thousand and Fifty Paisa Only".
export function amountInWords(amount: string | number): string {
  const paisa = Math.round(Math.abs(Number(amount)) * 100);
  const taka = Math.floor(paisa / 100);
  const rest = paisa % 100;
  const words = `Taka ${taka ? inWords(taka) : "Zero"}`;
  return `${words}${rest ? ` and ${belowHundred(rest)} Paisa` : ""} Only`;
}
