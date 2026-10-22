/** Approximate town centers in the Piedmont Triad. Used only to estimate drive distance. */

export const towns = [
  { id: "archdale", name: "Archdale", lat: 35.9146, lng: -79.9722 },
  { id: "asheboro", name: "Asheboro", lat: 35.7079, lng: -79.8136 },
  { id: "bermuda-run", name: "Bermuda Run", lat: 36.0032, lng: -80.4268 },
  { id: "burlington", name: "Burlington", lat: 36.0957, lng: -79.4378 },
  { id: "clemmons", name: "Clemmons", lat: 36.0215, lng: -80.382 },
  { id: "colfax", name: "Colfax", lat: 36.1135, lng: -80.0165 },
  { id: "elon", name: "Elon", lat: 36.1029, lng: -79.5064 },
  { id: "gibsonville", name: "Gibsonville", lat: 36.1057, lng: -79.5417 },
  { id: "graham", name: "Graham", lat: 36.069, lng: -79.4006 },
  { id: "greensboro", name: "Greensboro", lat: 36.0726, lng: -79.792 },
  { id: "high-point", name: "High Point", lat: 35.9557, lng: -80.0053 },
  { id: "jamestown", name: "Jamestown", lat: 35.9943, lng: -79.9353 },
  { id: "kernersville", name: "Kernersville", lat: 36.1199, lng: -80.0737 },
  { id: "king", name: "King", lat: 36.2807, lng: -80.3595 },
  { id: "lewisville", name: "Lewisville", lat: 36.0974, lng: -80.4167 },
  { id: "lexington", name: "Lexington", lat: 35.824, lng: -80.2534 },
  { id: "madison", name: "Madison", lat: 36.3854, lng: -79.9595 },
  { id: "oak-ridge", name: "Oak Ridge", lat: 36.1732, lng: -79.99 },
  { id: "reidsville", name: "Reidsville", lat: 36.3546, lng: -79.6645 },
  { id: "rural-hall", name: "Rural Hall", lat: 36.2285, lng: -80.2939 },
  { id: "stokesdale", name: "Stokesdale", lat: 36.2371, lng: -79.9831 },
  { id: "summerfield", name: "Summerfield", lat: 36.2088, lng: -79.9047 },
  { id: "thomasville", name: "Thomasville", lat: 35.8826, lng: -80.082 },
  { id: "trinity", name: "Trinity", lat: 35.8946, lng: -80.0092 },
  { id: "walkertown", name: "Walkertown", lat: 36.1735, lng: -80.1345 },
  { id: "winston-salem", name: "Winston-Salem", lat: 36.0999, lng: -80.2442 },
];

export const townById = Object.fromEntries(towns.map((town) => [town.id, town]));
