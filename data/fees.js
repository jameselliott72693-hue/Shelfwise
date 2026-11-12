/**
 * Published-fee estimates reviewed November 10, 2026.
 * Not a live checkout. Fees change by address, time, basket, and membership.
 * Nothing here is fetched from a delivery app. Where a chain's fee page did
 * not publish a number, the October 18, 2026 estimate is kept and labeled.
 */

export const FEE_AS_OF = "2026-11-10";
export const FEE_AS_OF_LABEL = "November 10, 2026";

export const FEE_NOTE =
  "Published-fee estimates reviewed November 10, 2026. Not a live checkout. Confirm the fee in the app before you pay. A service can be missing at a store even when the row shows a number.";

export const FEE_LINKS = {
  instacart: {
    url: "https://www.instacart.com/help/article/service-fee",
    label: "Instacart service fees",
  },
  doordash: {
    url: "https://www.doordash.com/",
    label: "DoorDash",
  },
  ubereats: {
    url: "https://www.ubereats.com/",
    label: "Uber Eats",
  },
  shipt: {
    url: "https://www.target.com/help/articles/target-circle/about-target-circle-360",
    label: "Target Circle 360 and Shipt fees",
  },
  chains: {
    aldi: {
      pickup: { url: "https://www.aldi.us/", label: "Aldi US" },
      delivery: { url: "https://www.aldi.us/", label: "Aldi US" },
    },
    lidl: {
      pickup: { url: "https://www.lidl.com/", label: "Lidl US" },
      delivery: { url: "https://www.lidl.com/", label: "Lidl US" },
    },
    walmart: {
      pickup: { url: "https://www.walmart.com/plus", label: "Walmart+" },
      delivery: { url: "https://www.walmart.com/plus", label: "Walmart+" },
    },
    foodlion: {
      pickup: { url: "https://www.foodlion.com/", label: "Food Lion" },
      delivery: { url: "https://www.foodlion.com/", label: "Food Lion" },
    },
    harristeeter: {
      pickup: {
        url: "https://www.harristeeter.com/hc/help/faqs/ways-to-shop/pickup",
        label: "Harris Teeter pickup FAQ",
      },
      delivery: {
        url: "https://www.harristeeter.com/i/hc/help/faqs/ht-online-shopping",
        label: "Harris Teeter online shopping FAQ",
      },
    },
    lowes: {
      pickup: {
        url: "https://www.lowesfoods.com/Shop-Online/Lowes-Foods-To-Go",
        label: "Lowes Foods To Go",
      },
      delivery: {
        url: "https://www.lowesfoods.com/Shop-Online/Lowes-Foods-To-Go",
        label: "Lowes Foods To Go",
      },
    },
    target: {
      pickup: {
        url: "https://corporate.target.com/about/products-services/pickup-delivery",
        label: "Target pickup and delivery",
      },
      delivery: {
        url: "https://www.target.com/help/articles/target-circle/about-target-circle-360",
        label: "Target Circle 360",
      },
    },
    publix: {
      pickup: { url: "https://www.publix.com/faq/instacart", label: "Publix and Instacart FAQ" },
      delivery: { url: "https://www.publix.com/faq/instacart", label: "Publix and Instacart FAQ" },
    },
  },
};

export const THIRD_PARTY = {
  instacart: {
    label: "Instacart",
    markup: 0.1,
    serviceRate: 0.05,
    serviceMin: 2,
    delivery: 7.99,
    memberKey: "instacartPlus",
    memberDelivery: 0,
    min: 35,
    memberMin: 10,
  },
  doordash: {
    label: "DoorDash",
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

function withSource(row, source) {
  return {
    ...row,
    asOfLabel: FEE_AS_OF_LABEL,
    sourceUrl: source?.url || "",
    sourceLabel: source?.label || "",
  };
}

export function deliveryRows(chain, shelf, memberships, tip) {
  const rows = [];
  const pickup = chain.services.pickup;
  const delivery = chain.services.delivery;

  const chainLinks = FEE_LINKS.chains[chain.id] || {};
  rows.push(withSource(pickup.available
    ? finish("Store pickup", pickup, shelf, 0, ownFee(pickup, shelf, memberships), 0, tip)
    : blankRow("Store pickup", pickup.note), chainLinks.pickup));

  rows.push(withSource(delivery.available
    ? finish("Store delivery", delivery, shelf, 0, ownFee(delivery, shelf, memberships), 0, tip)
    : blankRow("Store delivery", delivery.note), chainLinks.delivery));

  for (const key of ["instacart", "doordash", "ubereats", "shipt"]) {
    const coverage = chain.services[key];
    const plan = THIRD_PARTY[key];
    if (!coverage.available) {
      rows.push(withSource(blankRow(plan.label, coverage.note), FEE_LINKS[key]));
      continue;
    }
    const markupRate = key === "shipt" && chain.id === "target" ? 0 : plan.markup;
    const marked = round2(shelf * (1 + markupRate));
    const markup = round2(marked - shelf);
    const serviceFee = round2(Math.max(plan.serviceMin, marked * plan.serviceRate));
    const memberOn = Boolean(memberships[plan.memberKey]);
    const memberMin = plan.memberMin ?? plan.min;
    const meetsMin = shelf >= memberMin;
    const feeInfo = {
      fee: memberOn && meetsMin ? plan.memberDelivery : plan.delivery,
      memberApplied: memberOn && meetsMin,
      underMin: false,
    };
    const extras = [];
    if (markupRate === 0 && key === "shipt") extras.push("Target orders use a 0% markup estimate in this model.");
    if (key === "instacart") {
      extras.push("Instacart's delivery fee varies by store and window. Instacart+ is $0 delivery on eligible orders of $10 or more, and service fees still apply. The delivery dollar amount here is a typical estimate, not a quote.");
    }
    if (key === "doordash" || key === "ubereats") {
      extras.push("No single national grocery fee is published. This dollar amount is a typical estimate.");
    }
    rows.push(withSource(
      finish(plan.label, { ...coverage, everywhere: coverage.everywhere }, shelf, markup, feeInfo, serviceFee, tip, extras.join(" ")),
      FEE_LINKS[key],
    ));
  }

  return rows;
}
