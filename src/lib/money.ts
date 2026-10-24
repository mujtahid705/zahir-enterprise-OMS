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
