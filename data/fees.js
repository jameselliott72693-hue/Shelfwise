/**
 * Delivery and pickup fees. Not a live checkout.
 * Dollars re-checked on November 12, 2026 stay labeled in FEE_NOTE.
 * Dollars a public page did not fix stay the October 18, 2026 estimates.
 * Nothing here is fetched from a delivery app at runtime.
 */

export const FEE_AS_OF_LABEL = "October 18, 2026";

export const FEE_NOTE =
  "Fees re-checked November 12, 2026 where a public page loaded: Harris Teeter ExpressLane, Target same-day, Lowes Foods To Go, Walmart pickup over $35 and the $9.95 delivery, Instacart+ at $10, and Shipt member delivery over $35. Walmart's under-$35 add-on and Food Lion's pickup and delivery dollars are still October 18, 2026 estimates. Instacart, DoorDash, Uber Eats, and non-member Shipt rates that those pages do not fix are still the October 18 estimates. Not a live checkout. A service can be missing at a store even when the row shows a number.";

export const THIRD_PARTY = {
  instacart: {
    label: "Instacart",
    // Markup, service rate, and the $7.99 delivery figure are still October 18 estimates.
    // Instacart help, checked November 12, 2026, says those dollars vary and that
    // Instacart+ delivery is $0 on eligible orders of $10 or more.
    markup: 0.1,
    serviceRate: 0.05,
    serviceMin: 2,
    delivery: 7.99,
    memberKey: "instacartPlus",
    memberDelivery: 0,
    min: 10,
  },
  doordash: {
    label: "DoorDash",
    // DoorDash help, checked November 12, 2026, describes a variable service fee
    // outside a short list of markets. The 12% rate remains the October 18 estimate.
    markup: 0.15,
    serviceRate: 0.12,
    serviceMin: 0,
    delivery: 4.99,
    memberKey: "dashPass",
    memberDelivery: 0,
    min: 12,
  },
  ubereats: {
    label: "Uber Eats",
    markup: 0.15,
    serviceRate: 0.12,
    serviceMin: 0,
    delivery: 5.49,
    memberKey: "uberOne",
    memberDelivery: 0,
    min: 15,
  },
  shipt: {
    label: "Shipt",
    // Shipt pricing, checked November 12, 2026: members pay $0 delivery on orders
    // of $35 or more, and $7 under $35. This model cannot split that $7 from the
    // non-member delivery, so the $9.99 figure remains the October 18 estimate.
    markup: 0.08,
    serviceRate: 0,
    serviceMin: 0,
    delivery: 9.99,
    memberKey: "shipt",
    memberDelivery: 0,
    min: 35,
  },
};

export const MEMBERSHIPS = [
  { id: "walmartPlus", name: "Walmart+" },
  { id: "instacartPlus", name: "Instacart+" },
  { id: "dashPass", name: "DashPass" },
  { id: "uberOne", name: "Uber One" },
  { id: "shipt", name: "Shipt" },
  { id: "lowesToGo", name: "Lowes To Go" },
];

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function tipAmount(base, tip) {
  if (tip === "flat5") return 5;
  if (tip === "pct10") return round2(base * 0.1);
  return 0;
}

function ownFee(service, shelf, memberships) {
  const memberOn = Boolean(service.memberKey && memberships[service.memberKey]);
  const meetsMin = shelf >= (service.min || 0);
  if (memberOn && meetsMin) {
    return { fee: service.memberFee ?? 0, memberApplied: true, underMin: false };
  }
  let fee = service.fee || 0;
  const underMin = !meetsMin && service.underMinFee > 0;
  if (underMin) fee = round2(fee + service.underMinFee);
  return { fee, memberApplied: false, underMin };
}

function blankRow(name, note) {
  return {
    name,
    available: false,
    everywhere: false,
    note,
    food: null,
    markup: null,
    fee: null,
    service: null,
    tip: null,
    total: null,
  };
}

function finish(name, service, shelf, markup, feeInfo, serviceFee, tip, extraNote) {
  const food = round2(shelf);
  const markupDollars = round2(markup);
  const fee = round2(feeInfo.fee);
  const serviceDollars = round2(serviceFee);
  const beforeTip = round2(food + markupDollars + fee + serviceDollars);
  const tipDollars = tipAmount(beforeTip, tip);
  const notes = [service.note];
  if (feeInfo.memberApplied) notes.push("Membership toggle set the delivery or pickup fee to the member estimate.");
  if (feeInfo.underMin) notes.push(`Basket is under the $${service.min} estimate, so a small-order fee is added.`);
  if (extraNote) notes.push(extraNote);
  return {
    name,
    available: true,
    everywhere: Boolean(service.everywhere),
    note: notes.filter(Boolean).join(" "),
    food,
    markup: markupDollars,
    fee,
    service: serviceDollars,
    tip: tipDollars,
    total: round2(beforeTip + tipDollars),
  };
}

export function deliveryRows(chain, shelf, memberships, tip) {
  const rows = [];
  const pickup = chain.services.pickup;
  const delivery = chain.services.delivery;

  rows.push(pickup.available
    ? finish("Store pickup", pickup, shelf, 0, ownFee(pickup, shelf, memberships), 0, tip)
    : blankRow("Store pickup", pickup.note));

  rows.push(delivery.available
    ? finish("Store delivery", delivery, shelf, 0, ownFee(delivery, shelf, memberships), 0, tip)
    : blankRow("Store delivery", delivery.note));

  for (const key of ["instacart", "doordash", "ubereats", "shipt"]) {
    const coverage = chain.services[key];
    const plan = THIRD_PARTY[key];
    if (!coverage.available) {
      rows.push(blankRow(plan.label, coverage.note));
      continue;
    }
    const markupRate = key === "shipt" && chain.id === "target" ? 0 : plan.markup;
    const marked = round2(shelf * (1 + markupRate));
    const markup = round2(marked - shelf);
    const serviceFee = round2(Math.max(plan.serviceMin, marked * plan.serviceRate));
    const memberOn = Boolean(memberships[plan.memberKey]);
    const meetsMin = shelf >= plan.min;
    const feeInfo = {
      fee: memberOn && meetsMin ? plan.memberDelivery : plan.delivery,
      memberApplied: memberOn && meetsMin,
      underMin: false,
    };
    const extra = markupRate === 0 && key === "shipt"
      ? "Target orders use a 0% markup estimate in this model."
      : "";
    rows.push(finish(plan.label, { ...coverage, everywhere: coverage.everywhere }, shelf, markup, feeInfo, serviceFee, tip, extra));
  }

  return rows;
}
