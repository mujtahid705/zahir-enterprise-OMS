import { describe, expect, it } from "vitest";
import { forward, sendWarnings, whatsappLink } from "@/lib/sending";

describe("forward", () => {
  it("moves to a later status", () => {
    expect(forward("created", "wo_sent")).toBe("wo_sent");
    expect(forward("wo_sent", "invoiced")).toBe("invoiced");
  });

  it("never moves back or sideways", () => {
    expect(forward("invoiced", "wo_sent")).toBe("invoiced");
    expect(forward("delivered", "delivered")).toBe("delivered");
    expect(forward("completed", "invoiced")).toBe("completed");
  });

  it("leaves a cancelled Order cancelled", () => {
    expect(forward("cancelled", "invoiced")).toBe("cancelled");
  });
});

describe("sendWarnings", () => {
  const base = {
    pendingWorkOrders: 0,
    challanSent: true,
    locked: false,
    orderDate: "2026-10-20",
    today: "2026-10-23",
    date: "2026-10-23",
  };

  it("warns about pending Work Orders when sending the Challan", () => {
    expect(
      sendWarnings({ ...base, ref: { type: "challan" }, pendingWorkOrders: 2 }),
    ).toEqual(["2 Work Orders not sent yet. Continue?"]);
    expect(
      sendWarnings({ ...base, ref: { type: "challan" }, pendingWorkOrders: 1 }),
    ).toEqual(["1 Work Order not sent yet. Continue?"]);
  });

  it("warns that the Invoice comes before the Challan and locks the Order", () => {
    expect(
      sendWarnings({ ...base, ref: { type: "invoice" }, challanSent: false }),
    ).toEqual([
      "The Challan has not been sent yet. Continue?",
      "Sending the Invoice locks this order.",
    ]);
    expect(
      sendWarnings({ ...base, ref: { type: "invoice" }, locked: true }),
    ).toEqual([]);
  });

  it("warns about a date before the order date or in the future", () => {
    const wo = { type: "work_order", workOrderId: "x" } as const;
    expect(sendWarnings({ ...base, ref: wo, date: "2026-10-19" })).toEqual([
      "Date is before the order date.",
    ]);
    expect(sendWarnings({ ...base, ref: wo, date: "2026-10-24" })).toEqual([
      "Date is in the future.",
    ]);
    expect(sendWarnings({ ...base, ref: wo, pendingWorkOrders: 3 })).toEqual(
      [],
    );
  });
});

describe("whatsappLink", () => {
  it("adds Bangladesh's country code to a local number", () => {
    expect(whatsappLink("01711-245 880", "Hi there")).toBe(
      "https://wa.me/8801711245880?text=Hi%20there",
    );
  });

  it("keeps an international number as it is", () => {
    expect(whatsappLink("+880 1711 245880", "Hi")).toBe(
      "https://wa.me/8801711245880?text=Hi",
    );
  });

  it("gives nothing without a number", () => {
    expect(whatsappLink(" ", "Hi")).toBeNull();
  });
});
