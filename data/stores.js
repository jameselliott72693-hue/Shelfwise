/**
 * Eight chains that operate in the Piedmont Triad.
 * Coordinates are approximate, rounded from public map lookups of these
 * addresses. They stay on the device and are only used to estimate distance.
 * This is a working set of real stores, not every front door.
 */

const FULL_NOTE = "Not a live check, and not every address in the Triad.";

function own(partial) {
  return {
    available: false,
    everywhere: false,
    fee: 0,
    min: 35,
    underMinFee: 0,
    memberKey: null,
    memberFee: 0,
    note: "",
    ...partial,
  };
}

function partner(partial) {
  return { available: false, everywhere: false, note: "", ...partial };
}

function loc(id, label, address, city, lat, lng) {
  return { id, label, address, city, lat, lng };
}

export const chains = [
  {
    id: "aldi",
    name: "Aldi",
    loyalty: null,
    quality: { produce: -1, meat: -1, other: 0 },
    qualityNote: "Store brands carry the basket. Fresh cases swing more week to week in this model.",
    locations: [
      loc("aldi-gso-newgarden", "New Garden Rd", "1507 New Garden Rd", "Greensboro", 36.11072, -79.88311),
      loc("aldi-gso-battleground", "Battleground Ave", "2965 Battleground Ave", "Greensboro", 36.11393, -79.83624),
      loc("aldi-gso-gate", "W Gate City Blvd", "4222 W Gate City Blvd", "Greensboro", 36.03697, -79.86352),
      loc("aldi-gso-randleman", "Randleman Rd", "2920 Randleman Rd", "Greensboro", 36.0161, -79.8056),
      loc("aldi-kernersville", "S Main St", "819 S Main St", "Kernersville", 36.11001, -80.08682),
      loc("aldi-hp-north", "N Main St", "3306 N Main St", "High Point", 36.00386, -80.03663),
      loc("aldi-hp-south", "S Main St", "2651 S Main St", "High Point", 35.92722, -79.98526),
      loc("aldi-burlington", "S Church St", "1801 S Church St", "Burlington", 36.08494, -79.4601),
      loc("aldi-ws-peters", "Peters Creek Pkwy", "2715 Peters Creek Pkwy", "Winston-Salem", 36.05421, -80.25845),
      loc("aldi-ws-hanes", "W Hanes Mill Rd", "5622 W Hanes Mill Rd", "Winston-Salem", 36.17385, -80.2784),
      loc("aldi-clemmons", "Market Center Dr", "2455 Market Center Dr", "Clemmons", 36.03242, -80.38072),
      loc("aldi-asheboro", "E Dixie Dr", "1318 E Dixie Dr", "Asheboro", 35.69646, -79.78776),
      loc("aldi-thomasville", "Randolph St", "1033 Randolph St", "Thomasville", 35.86505, -80.06988),
      loc("aldi-lexington", "N Talbert Blvd", "101 N Talbert Blvd", "Lexington", 35.81534, -80.24502),
    ],
    services: {
      pickup: own({ note: "Aldi does not offer Triad-wide curbside in this model." }),
      delivery: own({ note: "Aldi does not offer Triad-wide store delivery in this model." }),
      instacart: partner({ note: "Instacart does not carry Aldi in this Triad model." }),
      doordash: partner({ note: "DoorDash does not take an Aldi cart in this Triad model." }),
      ubereats: partner({ note: "Uber Eats does not carry Aldi across the Triad in this model." }),
      shipt: partner({ note: "Shipt does not carry Aldi in this Triad model." }),
    },
  },
  {
    id: "lidl",
    name: "Lidl",
    loyalty: { id: "lidl-plus", name: "Lidl Plus" },
    quality: { produce: 0, meat: -1, other: 0 },
    qualityNote: "Bakery and produce land near the middle of this model. The meat case is thinner.",
    locations: [
      loc("lidl-gso-north", "Martinsville Rd", "3005 Martinsville Rd", "Greensboro", 36.1174, -79.83032),
      loc("lidl-gso-gate", "W Gate City Blvd", "5696 W Gate City Blvd", "Greensboro", 36.01782, -79.8955),
      loc("lidl-ws", "Sides Branch Rd", "3315 Sides Branch Rd", "Winston-Salem", 36.03232, -80.26138),
      loc("lidl-burlington", "S Church St", "3010 S Church St", "Burlington", 36.08055, -79.49146),
    ],
    services: {
      pickup: own({ note: "Lidl does not offer Triad-wide curbside in this model." }),
      delivery: own({ note: "Lidl does not offer Triad-wide store delivery in this model." }),
      instacart: partner({ note: "Instacart does not carry Lidl in this Triad model." }),
      doordash: partner({ note: "DoorDash does not take a Lidl cart in this Triad model." }),
      ubereats: partner({ note: "Uber Eats does not carry Lidl across the Triad in this model." }),
      shipt: partner({ note: "Shipt does not carry Lidl in this Triad model." }),
    },
  },
  {
    id: "walmart",
    name: "Walmart",
    loyalty: null,
    quality: { produce: -1, meat: -1, other: 0 },
    qualityNote: "Broad store brands. Produce and meat sit a step under the Triad baseline in this model.",
    locations: [
      loc("walmart-gso-battleground", "Battleground Ave", "3738 Battleground Ave", "Greensboro", 36.13524, -79.85541),
      loc("walmart-gso-wendover", "W Wendover Ave", "4424 W Wendover Ave", "Greensboro", 36.05809, -79.90094),
      loc("walmart-gso-friendly", "W Friendly Ave", "5611 W Friendly Ave", "Greensboro", 36.08769, -79.88627),
      loc("walmart-kernersville", "S Main St", "1130 S Main St", "Kernersville", 36.10751, -80.09917),
      loc("walmart-burlington", "Garden Rd", "3141 Garden Rd", "Burlington", 36.07216, -79.49903),
      loc("walmart-hp", "N Main St", "2710 N Main St", "High Point", 35.99462, -80.02883),
      loc("walmart-asheboro", "E Dixie Dr", "1226 E Dixie Dr", "Asheboro", 35.69226, -79.78956),
      loc("walmart-clemmons", "Clemmons Rd", "3633 Clemmons Rd", "Clemmons", 36.0211, -80.38027),
      loc("walmart-reidsville", "NC 14", "1624 NC 14", "Reidsville", 36.38343, -79.66722),
      loc("walmart-lexington", "Lowes Blvd", "160 Lowes Blvd", "Lexington", 35.79462, -80.25955),
      loc("walmart-ws-hanes", "E Hanes Mill Rd", "320 E Hanes Mill Rd", "Winston-Salem", 36.19251, -80.27446),
      loc("walmart-ws-university", "University Pkwy", "5039 University Pkwy", "Winston-Salem", 36.16079, -80.27691),
      loc("walmart-ws-kester", "Kester Mill Rd", "4550 Kester Mill Rd", "Winston-Salem", 36.06757, -80.33686),
      loc("walmart-ws-harvey", "Harvey St", "180 Harvey St", "Winston-Salem", 36.08627, -80.29422),
      loc("walmart-ws-brookberry", "Brookberry Park Ave", "5175 Brookberry Park Ave", "Winston-Salem", 36.09405, -80.36734),
      loc("walmart-ws-parkway", "Parkway Village Ct", "3475 Parkway Village Ct", "Winston-Salem", 36.02739, -80.26263),
    ],
    services: {
      pickup: own({
        available: true,
        fee: 0,
        underMinFee: 6.99,
        note: `Pickup fee estimate $0 on larger orders. ${FULL_NOTE}`,
      }),
      delivery: own({
        available: true,
        fee: 9.95,
        underMinFee: 6.99,
        memberKey: "walmartPlus",
        memberFee: 0,
        note: `Delivery fee estimate $9.95, or $0 over $35 with Walmart+. ${FULL_NOTE}`,
      }),
      instacart: partner({ note: "Walmart is not on Instacart in this Triad model." }),
      doordash: partner({
        available: true,
        note: `Some Triad Walmart stores appear on DoorDash. ${FULL_NOTE}`,
      }),
      ubereats: partner({
        available: true,
        note: `Uber Eats grocery at Walmart is spotty in the Triad. ${FULL_NOTE}`,
      }),
      shipt: partner({ note: "Shipt does not carry Walmart in this Triad model." }),
    },
  },
  {
    id: "foodlion",
    name: "Food Lion",
    loyalty: { id: "mvp", name: "Food Lion MVP" },
    quality: { produce: 0, meat: 0, other: 0 },
    qualityNote: "The baseline neighborhood grocer in this model: typical produce, meat, and grocery.",
    locations: [
      loc("foodlion-summerfield", "US 220", "4548 US Highway 220 N", "Summerfield", 36.19283, -79.89067),
      loc("foodlion-gso-lawndale", "Lawndale Dr", "4709 Lawndale Dr", "Greensboro", 36.1397, -79.83319),
      loc("foodlion-gso-elm", "N Elm St", "3501 N Elm St", "Greensboro", 36.12802, -79.79896),
      loc("foodlion-gso-randleman", "Randleman Rd", "3228 Randleman Rd", "Greensboro", 36.0072, -79.80733),
      loc("foodlion-gso-coliseum", "Coliseum Blvd", "1911 Coliseum Blvd", "Greensboro", 36.05158, -79.82095),
      loc("foodlion-gso-groometown", "Groometown Rd", "3603 Groometown Rd", "Greensboro", 36.01671, -79.86353),
      loc("foodlion-gso-market", "W Market St", "4653 W Market St", "Greensboro", 36.06821, -79.86704),
      loc("foodlion-kernersville", "Union Cross Rd", "1535 Union Cross Rd", "Kernersville", 36.07643, -80.10897),
      loc("foodlion-ws-somerset", "Somerset Center Dr", "2530 Somerset Center Dr", "Winston-Salem", 36.04888, -80.32929),
      loc("foodlion-ws-reynolda", "Reynolda Rd", "3800 Reynolda Rd", "Winston-Salem", 36.16138, -80.3267),
      loc("foodlion-hp-brian", "Brian Jordan Pl", "3935 Brian Jordan Pl", "High Point", 36.03354, -79.96146),
      loc("foodlion-hp-main", "N Main St", "2705 N Main St", "High Point", 35.99259, -80.0319),
      loc("foodlion-burlington", "Ramada Rd", "2660 Ramada Rd", "Burlington", 36.06816, -79.4701),
      loc("foodlion-asheboro", "E Dixie Dr", "1327 E Dixie Dr", "Asheboro", 35.6984, -79.78964),
      loc("foodlion-thomasville", "W Cooksey Dr", "902 W Cooksey Dr", "Thomasville", 35.89762, -80.09249),
      loc("foodlion-reidsville", "South Park Dr", "South Park Dr", "Reidsville", 36.32565, -79.68433),
    ],
    services: {
      pickup: own({
        available: true,
        fee: 0,
        underMinFee: 4.95,
        note: `Pickup fee estimate $0 on larger orders at most Triad stores. ${FULL_NOTE}`,
      }),
      delivery: own({
        available: true,
        fee: 7.95,
        underMinFee: 4.95,
        note: `Store delivery fee estimate $7.95. ${FULL_NOTE}`,
      }),
      instacart: partner({
        available: true,
        note: `Instacart lists many Food Lion stores. ${FULL_NOTE}`,
      }),
      doordash: partner({
        available: true,
        note: `DoorDash reaches some Food Lion stores. ${FULL_NOTE}`,
      }),
      ubereats: partner({
        available: true,
        note: `Uber Eats reaches some Food Lion stores. ${FULL_NOTE}`,
      }),
      shipt: partner({ note: "Shipt does not carry Food Lion in this Triad model." }),
    },
  },
  {
    id: "harristeeter",
    name: "Harris Teeter",
    loyalty: { id: "vic", name: "Harris Teeter VIC" },
    quality: { produce: 2, meat: 2, other: 1 },
    qualityNote: "Produce and meat sit at the top of this model, with a smaller lift on the rest of the shelf.",
    locations: [
      loc("ht-gso-lawndale", "Lawndale Crossing", "2639 Lawndale Dr", "Greensboro", 36.10334, -79.82138),
      loc("ht-gso-pisgah", "North Elm Village", "401 Pisgah Church Rd", "Greensboro", 36.13053, -79.79567),
      loc("ht-gso-friendly", "Friendly Center", "3330 W Friendly Ave", "Greensboro", 36.08796, -79.83752),
      loc("ht-kernersville", "Kernersville Marketplace", "971 S Main St", "Kernersville", 36.10719, -80.09471),
      loc("ht-hp-eastchester", "High Point", "265 Eastchester Dr", "High Point", 35.98456, -80.01913),
      loc("ht-hp-skeet", "Oak Hollow", "1589 Skeet Club Rd", "High Point", 36.03289, -79.96837),
      loc("ht-ws-reynolda", "Reynolda Rd", "2835 Reynolda Rd", "Winston-Salem", 36.14569, -80.29897),
      loc("ht-burlington", "S Church St", "2727 S Church St", "Burlington", 36.08075, -79.48775),
    ],
    services: {
      pickup: own({
        available: true,
        fee: 0,
        underMinFee: 4.95,
        note: `ExpressLane pickup fee estimate $0 on larger orders. ${FULL_NOTE}`,
      }),
      delivery: own({
        available: true,
        fee: 9.95,
        underMinFee: 4.95,
        note: `Harris Teeter delivery fee estimate $9.95. ${FULL_NOTE}`,
      }),
      instacart: partner({
        available: true,
        note: `Instacart lists many Harris Teeter stores. ${FULL_NOTE}`,
      }),
      doordash: partner({
        available: true,
        note: `DoorDash reaches some Harris Teeter stores. ${FULL_NOTE}`,
      }),
      ubereats: partner({
        available: true,
        note: `Uber Eats reaches some Harris Teeter stores. ${FULL_NOTE}`,
      }),
      shipt: partner({
        available: true,
        note: `Shipt has carried Harris Teeter in parts of the Triad. ${FULL_NOTE}`,
      }),
    },
  },
  {
    id: "lowes",
    name: "Lowes Foods",
    loyalty: { id: "rewards", name: "Lowes Foods Rewards" },
    quality: { produce: 1, meat: 1, other: 1 },
    qualityNote: "A step above the baseline on produce, meat, and grocery in this model. The chain is based in Winston-Salem.",
    locations: [
      loc("lowes-oakridge", "Oak Ridge", "2205 Oak Ridge Rd", "Oak Ridge", 36.17399, -79.99181),
      loc("lowes-gso-cardinal", "Cardinal", "6310 Old Oak Ridge Rd", "Greensboro", 36.12848, -79.93339),
      loc("lowes-gso-church", "N Church St", "5820 N Church St", "Greensboro", 36.12428, -79.78723),
      loc("lowes-ws-robinhood", "Robinhood Rd", "3372 Robinhood Rd", "Winston-Salem", 36.11521, -80.3143),
      loc("lowes-ws-reynolda", "Reynolda Rd", "Reynolda Rd", "Winston-Salem", 36.14331, -80.30034),
      loc("lowes-kernersville", "Market View Dr", "240 Market View Dr", "Kernersville", 36.11423, -80.08734),
      loc("lowes-clemmons", "Lewisville Clemmons Rd", "2501 Lewisville Clemmons Rd", "Clemmons", 36.02986, -80.38077),
    ],
    services: {
      pickup: own({
        available: true,
        fee: 0,
        underMinFee: 4.95,
        note: `Lowes Foods To Go pickup fee estimate $0 on larger orders. ${FULL_NOTE}`,
      }),
      delivery: own({
        available: true,
        fee: 7.95,
        underMinFee: 4.95,
        memberKey: "lowesToGo",
        memberFee: 0,
        note: `To Go delivery fee estimate $7.95, or $0 over $35 with Lowes To Go. ${FULL_NOTE}`,
      }),
      instacart: partner({
        available: true,
        note: `Instacart reaches some Lowes Foods stores. ${FULL_NOTE}`,
      }),
      doordash: partner({
        available: true,
        note: `DoorDash reaches some Lowes Foods stores. ${FULL_NOTE}`,
      }),
      ubereats: partner({
        available: true,
        note: `Uber Eats reaches some Lowes Foods stores. ${FULL_NOTE}`,
      }),
      shipt: partner({ note: "Shipt does not carry Lowes Foods in this Triad model." }),
    },
  },
  {
    id: "target",
    name: "Target",
    loyalty: { id: "circle", name: "Target Circle" },
    quality: { produce: 0, meat: -1, other: 1 },
    qualityNote: "Household and grocery are strong here. The meat case is a smaller department in this model.",
    locations: [
      loc("target-gso-lawndale", "Lawndale Dr", "2701 Lawndale Dr", "Greensboro", 36.10465, -79.82159),
      loc("target-gso-highwoods", "Highwoods Blvd", "1628 Highwoods Blvd", "Greensboro", 36.11393, -79.87598),
      loc("target-gso-bridford", "Bridford Pkwy", "1212 Bridford Pkwy", "Greensboro", 36.05648, -79.90729),
      loc("target-hp", "Mall Loop Rd", "1050 Mall Loop Rd", "High Point", 35.99353, -80.00814),
      loc("target-kernersville", "S Main St", "1090 S Main St", "Kernersville", 36.11004, -80.09948),
      loc("target-ws-hanes", "Hanes Mall Blvd", "1040 Hanes Mall Blvd", "Winston-Salem", 36.06922, -80.31999),
      loc("target-ws-university", "University Pkwy", "5420 University Pkwy", "Winston-Salem", 36.16821, -80.2791),
      loc("target-burlington", "University Dr", "1475 University Dr", "Burlington", 36.0664, -79.51997),
    ],
    services: {
      pickup: own({
        available: true,
        fee: 0,
        note: `Drive Up fee estimate $0. ${FULL_NOTE}`,
      }),
      delivery: own({
        available: true,
        fee: 9.99,
        underMinFee: 7,
        memberKey: "shipt",
        memberFee: 0,
        note: `Target same-day is Shipt in this model. Fee estimate $9.99, or $0 over $35 with a Shipt membership. ${FULL_NOTE}`,
      }),
      instacart: partner({ note: "Target is not on Instacart in this Triad model." }),
      doordash: partner({
        available: true,
        note: `DoorDash reaches some Target stores. ${FULL_NOTE}`,
      }),
      ubereats: partner({
        available: true,
        note: `Uber Eats reaches some Target stores. ${FULL_NOTE}`,
      }),
      shipt: partner({
        available: true,
        note: `Shipt is Target's usual same-day service. ${FULL_NOTE}`,
      }),
    },
  },
  {
    id: "publix",
    name: "Publix",
    loyalty: null,
    quality: { produce: 2, meat: 1, other: 1 },
    qualityNote: "Produce leads this model, with a smaller lift on meat and the rest of the store.",
    locations: [
      loc("publix-gso", "Grandover", "6029 W Gate City Blvd", "Greensboro", 35.99998, -79.90597),
      loc("publix-ws-miller", "Miller St", "34 Miller St", "Winston-Salem", 36.0947, -80.27574),
      loc("publix-ws-westedge", "Robin Lark Cir", "5525 Robin Lark Cir", "Winston-Salem", 36.12048, -80.36938),
      loc("publix-hp", "N Main St", "2005 N Main St", "High Point", 35.98122, -80.02224),
      loc("publix-burlington", "S Church St", "2750 S Church St", "Burlington", 36.07962, -79.4858),
    ],
    services: {
      pickup: own({
        available: true,
        fee: 0,
        underMinFee: 4.95,
        note: `Publix pickup fee estimate $0 where the store offers it. ${FULL_NOTE}`,
      }),
      delivery: own({
        note: "Publix delivery in the Triad usually runs through Instacart, on its own row below.",
      }),
      instacart: partner({
        available: true,
        note: `Instacart is the usual Publix partner in this model. ${FULL_NOTE}`,
      }),
      doordash: partner({
        available: true,
        note: `DoorDash reaches some Publix stores. ${FULL_NOTE}`,
      }),
      ubereats: partner({
        available: true,
        note: `Uber Eats reaches some Publix stores. ${FULL_NOTE}`,
      }),
      shipt: partner({ note: "Shipt is not the usual Publix partner in this Triad model." }),
    },
  },
];

export const chainById = Object.fromEntries(chains.map((chain) => [chain.id, chain]));
