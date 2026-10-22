/** Catalog of comparable packages. Brand names are labels for the tier, not a claim that every store stocks that exact recipe. */

export const FULL = ["walmart", "foodlion", "target", "lowes", "harristeeter", "publix"];
export const ALL = ["aldi", "lidl", "walmart", "foodlion", "target", "lowes", "harristeeter", "publix"];

export const STORE_BRAND = {
  aldi: "Aldi store brand",
  lidl: "Lidl store brand",
  walmart: "Great Value",
  foodlion: "Food Lion",
  target: "Good & Gather",
  lowes: "Lowes Foods",
  harristeeter: "Harris Teeter",
  publix: "Publix",
};

const DEPT = { Produce: "produce", Meat: "meat" };

function item(row) {
  const aisle = row.aisle || "Pantry";
  return {
    department: DEPT[aisle] || "other",
    defaultTier: "store",
    nameAt: row.nameBase != null ? FULL : [],
    premiumAt: row.premiumBase != null ? FULL : [],
    storeBrands: {},
    tags: [],
    brands: { store: "Store brand", name: "", premium: "" },
    premiumSize: "",
    ...row,
    aisle,
  };
}

export const items = [
  item({ id: "milk", name: "Whole milk", size: "1 gal", aisle: "Dairy", base: 3.69, premiumBase: 6.49, premiumAt: ALL, brands: { store: "Store milk", name: "", premium: "Organic whole milk" }, tags: ["Organic Valley", "Simply Nature"], storeBrands: { aldi: "Friendly Farms", walmart: "Great Value", target: "Good & Gather" } }),
  item({ id: "eggs", name: "Large eggs", size: "1 dozen", aisle: "Dairy", base: 2.99, nameBase: 4.29, premiumBase: 5.49, brands: { store: "Store eggs", name: "Eggland's Best", premium: "Organic eggs" }, tags: ["Eggland's Best"] }),
  item({ id: "bread", name: "Sandwich bread", size: "20 oz", aisle: "Pantry", base: 1.79, nameBase: 3.29, premiumBase: 4.49, brands: { store: "Store bread", name: "Nature's Own", premium: "Bakery whole grain" }, tags: ["Nature's Own"], storeBrands: { aldi: "L'oven Fresh", lidl: "Lidl bakery" } }),
  item({ id: "bananas", name: "Bananas", size: "3 lb", aisle: "Produce", base: 1.77, premiumBase: 2.49, premiumAt: ALL, brands: { store: "Bananas", name: "", premium: "Organic bananas" }, tags: ["Organic"] }),
  item({ id: "apples", name: "Gala apples", size: "3 lb bag", aisle: "Produce", base: 4.49, premiumBase: 5.99, premiumAt: ALL, brands: { store: "Gala apples", name: "", premium: "Organic apples" }, tags: ["Organic"] }),
  item({ id: "salad", name: "Salad mix", size: "11 oz", aisle: "Produce", base: 2.99, nameBase: 3.79, brands: { store: "Store salad mix", name: "Fresh Express", premium: "" }, tags: ["Fresh Express"] }),
  item({ id: "berries", name: "Strawberries", size: "1 lb", aisle: "Produce", base: 3.99, premiumBase: 4.99, premiumAt: ALL, brands: { store: "Strawberries", name: "", premium: "Organic strawberries" }, tags: ["Organic"] }),
  item({ id: "broccoli", name: "Broccoli crowns", size: "1 lb", aisle: "Produce", base: 2.29, premiumBase: 2.99, premiumAt: ALL, brands: { store: "Broccoli", name: "", premium: "Organic broccoli" }, tags: ["Organic"] }),
  item({ id: "potatoes", name: "Russet potatoes", size: "5 lb", aisle: "Produce", base: 4.49, premiumBase: 5.49, premiumAt: ALL, brands: { store: "Russet potatoes", name: "", premium: "Organic potatoes" }, tags: ["Organic"] }),
  item({ id: "onions", name: "Yellow onions", size: "3 lb", aisle: "Produce", base: 2.79, premiumBase: 3.49, premiumAt: ALL, brands: { store: "Yellow onions", name: "", premium: "Organic onions" }, tags: ["Organic"] }),
  item({ id: "lettuce", name: "Iceberg lettuce", size: "1 head", aisle: "Produce", base: 1.99, premiumBase: 2.79, brands: { store: "Iceberg lettuce", name: "", premium: "Organic lettuce" } }),
  item({ id: "tomato", name: "Tomatoes", size: "1 lb", aisle: "Produce", base: 2.49, premiumBase: 3.49, premiumAt: ALL, brands: { store: "Tomatoes", name: "", premium: "Organic tomatoes" }, tags: ["Organic"] }),
  item({ id: "chicken", name: "Boneless chicken breast", size: "3 lb", aisle: "Meat", base: 10.47, premiumBase: 14.99, premiumAt: ALL, brands: { store: "Chicken breast", name: "", premium: "Air-chilled chicken breast" }, storeBrands: { aldi: "Never Any!" } }),
  item({ id: "beef", name: "Ground beef, 80% lean", size: "2 lb", aisle: "Meat", base: 9.98, premiumBase: 12.99, brands: { store: "Ground beef 80%", name: "", premium: "Ground beef 90% lean" }, storeBrands: { aldi: "Never Any!" } }),
  item({ id: "bacon", name: "Bacon", size: "16 oz", aisle: "Meat", base: 5.99, nameBase: 7.49, premiumBase: 8.99, brands: { store: "Store bacon", name: "Oscar Mayer", premium: "Thick-cut bacon" }, tags: ["Oscar Mayer"] }),
  item({ id: "pork", name: "Pork chops", size: "2 lb", aisle: "Meat", base: 8.49, premiumBase: 11.49, brands: { store: "Pork chops", name: "", premium: "Thick-cut pork chops" } }),
  item({ id: "salmon", name: "Salmon fillet", size: "1 lb", aisle: "Meat", base: 9.99, premiumBase: 13.99, brands: { store: "Farmed salmon", name: "", premium: "Atlantic salmon" } }),
  item({ id: "cheddar", name: "Sharp cheddar", size: "8 oz", aisle: "Dairy", base: 2.79, nameBase: 3.79, premiumBase: 5.49, brands: { store: "Store cheddar", name: "Kraft", premium: "Cabot" }, tags: ["Kraft", "Cabot"], storeBrands: { aldi: "Happy Farms" } }),
  item({ id: "yogurt", name: "Plain Greek yogurt", size: "32 oz", aisle: "Dairy", base: 4.99, nameBase: 5.99, premiumBase: 6.79, brands: { store: "Store Greek yogurt", name: "Fage", premium: "Organic Greek yogurt" }, tags: ["Fage", "Chobani"], storeBrands: { aldi: "Friendly Farms" } }),
  item({ id: "butter", name: "Salted butter", size: "1 lb", aisle: "Dairy", base: 4.49, nameBase: 5.49, premiumBase: 6.29, brands: { store: "Store butter", name: "Land O Lakes", premium: "European-style butter" }, tags: ["Land O Lakes"], storeBrands: { aldi: "Countryside Creamery" } }),
  item({ id: "oj", name: "Orange juice", size: "52 oz", aisle: "Drinks", base: 3.79, nameBase: 4.89, premiumBase: 5.49, brands: { store: "Store orange juice", name: "Tropicana", premium: "Not-from-concentrate juice" }, tags: ["Tropicana"] }),
  item({ id: "cereal", name: "Toasted oat cereal", size: "18 oz", aisle: "Pantry", base: 2.69, nameBase: 4.79, premiumBase: 5.49, brands: { store: "Store toasted oats", name: "Cheerios", premium: "Organic toasted oats" }, tags: ["Cheerios", "Millville", "Crownfield"], storeBrands: { aldi: "Millville", lidl: "Crownfield", walmart: "Great Value", target: "Good & Gather" } }),
  item({ id: "oats", name: "Old-fashioned oats", size: "18 oz", aisle: "Pantry", base: 2.49, nameBase: 3.79, premiumBase: 4.99, brands: { store: "Store oats", name: "Quaker", premium: "Organic oats" }, tags: ["Quaker"] }),
  item({ id: "pasta", name: "Spaghetti", size: "16 oz", aisle: "Pantry", base: 1.19, nameBase: 1.89, premiumBase: 2.79, brands: { store: "Store spaghetti", name: "Barilla", premium: "Bronze-cut spaghetti" }, tags: ["Barilla"] }),
  item({ id: "sauce", name: "Marinara sauce", size: "24 oz", aisle: "Pantry", base: 1.79, nameBase: 2.49, premiumBase: 8.49, brands: { store: "Store marinara", name: "Prego", premium: "Rao's" }, tags: ["Prego", "Rao's"] }),
  item({ id: "rice", name: "Long grain white rice", size: "2 lb", aisle: "Pantry", base: 2.19, nameBase: 2.99, brands: { store: "Store rice", name: "Mahatma", premium: "" }, tags: ["Mahatma"] }),
  item({ id: "coffee", name: "Ground coffee", size: "12 oz", aisle: "Pantry", base: 5.49, nameBase: 6.99, premiumBase: 9.99, brands: { store: "Store coffee", name: "Maxwell House", premium: "Starbucks" }, tags: ["Maxwell House", "Starbucks"] }),
  item({ id: "coke", name: "Cola", size: "12 × 12 oz cans", premiumSize: "6 × 12 oz glass bottles", aisle: "Drinks", base: 4.79, nameBase: 8.49, nameAt: ALL, premiumBase: 7.49, brands: { store: "Store cola", name: "Coca-Cola", premium: "Coca-Cola glass bottles" }, tags: ["Coca-Cola", "Coke"] }),
  item({ id: "water", name: "Spring water", size: "24 pack, 16.9 oz", aisle: "Drinks", base: 3.99, nameBase: 5.49, brands: { store: "Store water", name: "Dasani", premium: "" }, tags: ["Dasani"], storeBrands: { aldi: "PurAqua" } }),
  item({ id: "chips", name: "Potato chips", size: "8 oz", aisle: "Pantry", base: 2.79, nameBase: 3.79, premiumBase: 4.29, brands: { store: "Store chips", name: "Lay's", premium: "Kettle-cooked chips" }, tags: ["Lay's", "Lays"] }),
  item({ id: "mayo", name: "Mayonnaise", size: "32 oz", aisle: "Pantry", base: 3.29, nameBase: 5.49, premiumBase: 7.99, brands: { store: "Store mayonnaise", name: "Duke's", premium: "Avocado-oil mayo" }, tags: ["Duke's", "Dukes"] }),
  item({ id: "ketchup", name: "Ketchup", size: "20 oz", aisle: "Pantry", base: 1.99, nameBase: 2.79, nameAt: ALL, brands: { store: "Store ketchup", name: "Heinz", premium: "" }, tags: ["Heinz"] }),
  item({ id: "buns", name: "Hamburger buns", size: "8 count", aisle: "Pantry", base: 1.69, nameBase: 2.79, brands: { store: "Store buns", name: "Ball Park", premium: "" }, tags: ["Ball Park"] }),
  item({ id: "pb", name: "Peanut butter", size: "16 oz", aisle: "Pantry", base: 2.19, nameBase: 3.29, premiumBase: 5.49, brands: { store: "Store peanut butter", name: "Jif", premium: "Natural peanut butter" }, tags: ["Jif"] }),
  item({ id: "beans", name: "Black beans", size: "15 oz", aisle: "Pantry", base: 0.92, nameBase: 1.39, brands: { store: "Store black beans", name: "Bush's", premium: "" }, tags: ["Bush's", "Bushs"] }),
  item({ id: "oil", name: "Vegetable oil", size: "48 oz", aisle: "Pantry", base: 4.29, brands: { store: "Store vegetable oil", name: "", premium: "" } }),
  item({ id: "tuna", name: "Chunk light tuna", size: "5 oz", aisle: "Pantry", base: 1.09, nameBase: 1.39, brands: { store: "Store tuna", name: "StarKist", premium: "" }, tags: ["StarKist"] }),
  item({ id: "broth", name: "Chicken broth", size: "32 oz", aisle: "Pantry", base: 1.69, nameBase: 2.19, brands: { store: "Store broth", name: "Swanson", premium: "" }, tags: ["Swanson"] }),
  item({ id: "flour", name: "All-purpose flour", size: "5 lb", aisle: "Pantry", base: 3.19, nameBase: 5.49, premiumBase: 6.49, brands: { store: "Store flour", name: "King Arthur", premium: "Organic all-purpose flour" }, tags: ["King Arthur"] }),
  item({ id: "icecream", name: "Vanilla ice cream", size: "48 oz", aisle: "Frozen", base: 3.49, nameBase: 4.79, brands: { store: "Store vanilla", name: "Breyers", premium: "" }, tags: ["Breyers"] }),
  item({ id: "pint", name: "Ice cream pint", size: "1 pint", aisle: "Frozen", base: 1.79, nameBase: 4.49, brands: { store: "Store pint", name: "Ben & Jerry's", premium: "" }, tags: ["Ben & Jerry's", "Ben and Jerry's"] }),
  item({ id: "pizza", name: "Frozen cheese pizza", size: "1 pizza", aisle: "Frozen", base: 4.29, nameBase: 6.49, brands: { store: "Store pizza", name: "DiGiorno", premium: "" }, tags: ["DiGiorno"] }),
  item({ id: "frozveg", name: "Frozen mixed vegetables", size: "16 oz", aisle: "Frozen", base: 1.29, nameBase: 1.99, brands: { store: "Store mixed vegetables", name: "Birds Eye", premium: "" }, tags: ["Birds Eye", "BirdsEye"] }),
  item({ id: "detergent", name: "Laundry detergent", size: "92 fl oz", aisle: "Household", base: 8.49, nameBase: 12.99, premiumBase: 16.99, brands: { store: "Store detergent", name: "Tide", premium: "Persil" }, tags: ["Tide", "Persil", "Tandil"], storeBrands: { aldi: "Tandil", lidl: "W5", walmart: "Great Value", target: "Up & Up", foodlion: "Food Lion", lowes: "Lowes Foods", harristeeter: "Harris Teeter", publix: "Publix" } }),
  item({ id: "towels", name: "Paper towels", size: "6 double rolls", aisle: "Household", base: 6.99, nameBase: 9.49, brands: { store: "Store paper towels", name: "Bounty", premium: "" }, tags: ["Bounty"], storeBrands: { target: "Up & Up", aldi: "Boulder" } }),
  item({ id: "tp", name: "Bath tissue", size: "12 double rolls", aisle: "Household", base: 7.49, nameBase: 9.99, brands: { store: "Store bath tissue", name: "Charmin", premium: "" }, tags: ["Charmin"], storeBrands: { target: "Up & Up" } }),
  item({ id: "dish", name: "Dish soap", size: "24 oz", aisle: "Household", base: 2.49, nameBase: 3.49, brands: { store: "Store dish soap", name: "Dawn", premium: "" }, tags: ["Dawn"], storeBrands: { target: "Up & Up" } }),
  item({ id: "trash", name: "Trash bags", size: "40 bags", aisle: "Household", base: 6.49, nameBase: 8.49, brands: { store: "Store trash bags", name: "Glad", premium: "" }, tags: ["Glad"], storeBrands: { target: "Up & Up" } }),
  item({ id: "foil", name: "Aluminum foil", size: "75 sq ft", aisle: "Household", base: 3.79, nameBase: 4.99, brands: { store: "Store foil", name: "Reynolds", premium: "" }, tags: ["Reynolds"], storeBrands: { target: "Up & Up" } }),
];

export const itemById = Object.fromEntries(items.map((entry) => [entry.id, entry]));

export const aisles = ["Produce", "Meat", "Dairy", "Frozen", "Pantry", "Drinks", "Household"];

const FEATURED_BRANDS = ["Cheerios", "Duke's", "Tide", "Coca-Cola"];

export function brandOptions() {
  const set = new Set(FEATURED_BRANDS);
  for (const entry of items) {
    for (const tag of entry.tags) set.add(tag);
  }
  const rest = [...set].filter((name) => !FEATURED_BRANDS.includes(name));
  rest.sort((a, b) => a.localeCompare(b));
  return [...FEATURED_BRANDS, ...rest];
}

export function brandLabel(entry, storeId, tier) {
  if (tier === "name") return entry.brands.name || "Name brand";
  if (tier === "premium") return entry.brands.premium || "Premium";
  return entry.storeBrands?.[storeId] || STORE_BRAND[storeId] || "Store brand";
}

export function packageSize(entry, tier) {
  if (tier === "premium" && entry.premiumSize) return entry.premiumSize;
  return entry.size;
}

function line(itemId, qty, tier) {
  return { itemId, qty, tier };
}

export const presets = [
  {
    id: "family",
    name: "Family week",
    blurb: "A Summerfield week for four.",
    lines: [
      line("milk", 2, "store"),
      line("eggs", 2, "store"),
      line("bread", 2, "store"),
      line("bananas", 1, "store"),
      line("apples", 1, "store"),
      line("berries", 1, "store"),
      line("salad", 1, "store"),
      line("potatoes", 1, "store"),
      line("chicken", 2, "store"),
      line("beef", 1, "store"),
      line("bacon", 1, "store"),
      line("cheddar", 2, "store"),
      line("yogurt", 1, "store"),
      line("cereal", 1, "store"),
      line("pasta", 2, "store"),
      line("sauce", 2, "store"),
      line("rice", 1, "store"),
      line("coffee", 1, "store"),
      line("butter", 1, "store"),
      line("oj", 1, "store"),
      line("frozveg", 2, "store"),
      line("coke", 1, "name"),
    ],
  },
  {
    id: "breakfasts",
    name: "Breakfasts",
    blurb: "Morning staples.",
    lines: [
      line("milk", 1, "store"),
      line("eggs", 1, "store"),
      line("bread", 1, "store"),
      line("butter", 1, "store"),
      line("coffee", 1, "name"),
      line("yogurt", 1, "name"),
      line("bananas", 1, "store"),
      line("oats", 1, "name"),
      line("oj", 1, "name"),
      line("bacon", 1, "store"),
    ],
  },
  {
    id: "cookout",
    name: "Cookout",
    blurb: "Burgers, sides, and a cooler.",
    lines: [
      line("beef", 2, "store"),
      line("buns", 2, "store"),
      line("cheddar", 1, "store"),
      line("mayo", 1, "name"),
      line("ketchup", 1, "name"),
      line("lettuce", 1, "store"),
      line("tomato", 2, "store"),
      line("chips", 2, "name"),
      line("coke", 2, "name"),
      line("icecream", 1, "name"),
    ],
  },
  {
    id: "pantry",
    name: "Pantry",
    blurb: "Dry goods to restock.",
    lines: [
      line("pasta", 4, "store"),
      line("sauce", 3, "name"),
      line("rice", 2, "store"),
      line("pb", 1, "name"),
      line("beans", 4, "store"),
      line("cereal", 1, "name"),
      line("flour", 1, "name"),
      line("oil", 1, "store"),
      line("tuna", 4, "name"),
      line("broth", 2, "name"),
      line("oats", 1, "store"),
      line("coffee", 1, "premium"),
    ],
  },
  {
    id: "household",
    name: "Household",
    blurb: "Cleaning and paper.",
    lines: [
      line("detergent", 1, "name"),
      line("towels", 1, "store"),
      line("tp", 1, "store"),
      line("dish", 1, "name"),
      line("trash", 1, "store"),
      line("foil", 1, "name"),
    ],
  },
];

export const presetById = Object.fromEntries(presets.map((preset) => [preset.id, preset]));

export function cloneLines(lines) {
  return lines.map((entry) => ({ itemId: entry.itemId, qty: entry.qty, tier: entry.tier }));
}
