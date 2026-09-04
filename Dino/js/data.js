/* ==========================================================================
   DinoMart — catalogue data
   A curated, self-contained dataset inspired by dinomart.io
   Prices are in USD (base currency). All content is fictional / illustrative.
   ========================================================================== */

window.DINO = window.DINO || {};

/* ---- Category tree -------------------------------------------------------- */
DINO.categories = [
  {
    id: "toys",
    label: "Shop Toys",
    blurb: "Figures, boosters, plush and dice from every corner of pop culture.",
    subcategories: [
      "Marvel", "DC Comics", "Funko Pop!", "Stranger Things",
      "Magic: The Gathering", "Transformers", "Masters of the Universe",
      "Retro Games", "Dinosaurs!", "Blokees", "McFarlane Toys",
      "K-Pop Demon Hunters", "Little Rebels"
    ]
  },
  {
    id: "shwag",
    label: "DinoFam Shwag",
    blurb: "Wear the pack. Tees, hoodies and homeware straight from the DinoFam vault.",
    subcategories: [
      "Men's Apparel", "Women's Apparel", "Kid's Apparel",
      "Household Items", "Limited Editions", "Toys & Games"
    ]
  }
];

/* ---- Products ----------------------------------------------------------------
   fields:
   id, name, brand, price, compareAt?, category, sub, tags[], rating, reviews,
   inStock, badge?, blurb, description, glyph (emoji), hue (0-360 for artwork),
   featured?, drop? (ISO date for countdown)
--------------------------------------------------------------------------------*/
DINO.products = [
  {
    id: "spidey-77-retro",
    name: 'Marvel Legends Series Spider-Man \'77 — 6" Retro Movie Figure',
    brand: "Hasbro", price: 29.99, category: "toys", sub: "Marvel",
    tags: ["figure", "retro", "6-inch", "bestseller"], rating: 4.8, reviews: 214,
    inStock: true, badge: "Bestseller", glyph: "🕷️", hue: 4, featured: true,
    blurb: "Web-slinger in the classic 1977 TV suit with premium retro-card packaging.",
    description:
      "Celebrate the live-action Spider-Man that started it all. This 6-inch Marvel Legends figure recreates the 1977 television costume with over 20 points of articulation, two swappable head sculpts and a set of web-effect accessories. Ships on a nostalgia-drenched retro blister card that looks right at home on the shelf or still sealed."
  },
  {
    id: "mtg-hobbit-booster",
    name: "Magic: The Gathering — The Hobbit Play Booster Box (30 Packs)",
    brand: "Wizards of the Coast", price: 189.99, category: "toys", sub: "Magic: The Gathering",
    tags: ["tcg", "sealed", "booster-box"], rating: 4.9, reviews: 87,
    inStock: true, badge: "Hot", glyph: "🃏", hue: 275, featured: true,
    blurb: "30 Play Boosters of Middle-earth's newest set — sealed, ready to draft.",
    description:
      "An unexpected journey to your table. Each Play Booster Box contains 30 packs with 14 cards per pack, including at least one rare or mythic rare, a traditional foil and a full-art land. Perfect for two full drafts or a season of kitchen-table battles across the Shire, Rivendell and Mount Doom."
  },
  {
    id: "snorlax-backpack",
    name: "Pokémon Snorlax Midsize Backpack — Loungefly",
    brand: "Loungefly", price: 90.99, category: "shwag", sub: "Household Items",
    tags: ["bag", "loungefly", "pokemon"], rating: 4.7, reviews: 156,
    inStock: true, glyph: "🎒", hue: 205, featured: true,
    blurb: "Nap champion energy. Sculpted Snorlax face, plush ears and roomy interior.",
    description:
      "A midsize faux-leather backpack shaped like everyone's favourite sleeping giant. Features a 3D moulded face, floppy plush ears, printed-lining interior, padded straps and a laptop sleeve. Big enough for con day, comfy enough for the commute."
  },
  {
    id: "digital-dinoflage-trex",
    name: "Bad Baby Dinos — Digital Dinoflage™ T-Rex Plush",
    brand: "DinoFam", price: 29.99, category: "toys", sub: "Dinosaurs!",
    tags: ["plush", "dinofam", "exclusive"], rating: 4.9, reviews: 342,
    inStock: true, badge: "DinoFam Exclusive", glyph: "🦖", hue: 140, featured: true,
    drop: "2026-10-01T17:00:00Z",
    blurb: "The mascot of the movement. Ember-and-jungle camo, embroidered grin, huge attitude.",
    description:
      "The plush that started #VibeJurassic. Our Digital Dinoflage™ T-Rex wears a custom fire-and-jungle camo print, stitched claws and an embroidered smirk. Bean-weighted feet so it stands guard on your desk. A portion of every Bad Baby Dinos sale funds community relief partners."
  },
  {
    id: "dc-multiverse-batman",
    name: 'DC Multiverse — Batman: The Dark Knight Returns 7" Figure',
    brand: "McFarlane Toys", price: 24.99, category: "toys", sub: "DC Comics",
    tags: ["figure", "7-inch", "mcfarlane"], rating: 4.6, reviews: 98,
    inStock: true, glyph: "🦇", hue: 220,
    blurb: "Frank Miller's tank-built Batman with cloth-look cape and base.",
    description:
      "A 7-inch collector figure based on Frank Miller's era-defining run. Ultra-articulated, sculpted with the bulky armour silhouette and packed with a display base, alternate hands and a collectible art card."
  },
  {
    id: "transformers-hotwheels-coupe",
    name: "Transformers x Hot Wheels — El Segundo Coupe 5-Inch Converting Figure",
    brand: "Hasbro & Mattel", price: 34.99, category: "toys", sub: "Transformers",
    tags: ["figure", "converting", "crossover"], rating: 4.5, reviews: 61,
    inStock: true, badge: "Crossover", glyph: "🤖", hue: 30,
    blurb: "Two toy legends, one mould. Converts from coupe to robot in 18 steps.",
    description:
      "A collaboration crossover that turns a die-cast-style Hot Wheels coupe into a fully poseable 5-inch robot in 18 steps. Includes blaster accessory and dual-branded collector packaging."
  },
  {
    id: "ripley-vhs-pop",
    name: "Alien — Ripley Funko Pop! VHS Cover Figure #23 (with Hard Case)",
    brand: "Funko", price: 24.99, category: "toys", sub: "Funko Pop!",
    tags: ["funko", "vinyl", "vhs-cover"], rating: 4.7, reviews: 73,
    inStock: true, glyph: "👽", hue: 95,
    blurb: "Ellen Ripley in flamethrower pose, boxed with a protective VHS-style case.",
    description:
      "Part of the retro VHS Cover line. Ripley stands ready with her flamethrower inside a diorama sleeve designed like a worn video-store tape, protected by a stackable hard case."
  },
  {
    id: "duncan-tall-chase",
    name: "A Knight of the Seven Kingdoms — Ser Duncan the Tall Funko Pop! #1901 (Chase)",
    brand: "Funko", price: 51.99, compareAt: 59.99, category: "toys", sub: "Funko Pop!",
    tags: ["funko", "chase", "grail"], rating: 4.8, reviews: 40,
    inStock: true, badge: "Chase Variant", glyph: "⚔️", hue: 45,
    blurb: "The 1-in-6 Chase edition with battle-worn deco and metallic accents.",
    description:
      "The elusive Chase variant of Ser Duncan the Tall, featuring alternate battle-damaged paint, a metallic shield and Chase sticker. Randomly inserted at a 1-in-6 ratio — this listing guarantees the Chase."
  },
  {
    id: "duncan-tall-common",
    name: "A Knight of the Seven Kingdoms — Ser Duncan the Tall Funko Pop! #1901",
    brand: "Funko", price: 14.99, category: "toys", sub: "Funko Pop!",
    tags: ["funko", "vinyl"], rating: 4.6, reviews: 52,
    inStock: true, glyph: "🛡️", hue: 48,
    blurb: "Standard edition of the hedge knight, sword drawn.",
    description:
      "The common edition of Ser Duncan the Tall from A Knight of the Seven Kingdoms, sculpted mid-stride with sword drawn and window-boxed for display."
  },
  {
    id: "tanselle-pop",
    name: "A Knight of the Seven Kingdoms — Tanselle Funko Pop! #1900",
    brand: "Funko", price: 14.99, category: "toys", sub: "Funko Pop!",
    tags: ["funko", "vinyl"], rating: 4.4, reviews: 21,
    inStock: false, glyph: "🎪", hue: 320,
    blurb: "The travelling puppeteer, painted dragon puppet in hand.",
    description:
      "Tanselle the puppeteer joins the wave with her hand-painted dragon puppet accessory. Currently sold out — join the waitlist to be notified on restock."
  },
  {
    id: "wolf-predator-pop",
    name: "Aliens vs. Predator: Requiem — Wolf Predator Funko Pop! #1998",
    brand: "Funko", price: 14.99, category: "toys", sub: "Funko Pop!",
    tags: ["funko", "vinyl"], rating: 4.5, reviews: 33,
    inStock: true, glyph: "💀", hue: 160,
    blurb: "Cleaner-crew Predator with bio-mask and wrist blades.",
    description:
      "Wolf, the lone Predator sent to clean up the AvP:R outbreak, rendered in Pop! form with removable-look bio-mask sculpt and extended wrist blades."
  },
  {
    id: "spidey-ir-helicopter",
    name: "2CH Spider-Man Marvel IR Helicopter",
    brand: "World Tech Toys", price: 39.99, category: "toys", sub: "Marvel",
    tags: ["rc", "flying", "kids"], rating: 4.2, reviews: 45,
    inStock: true, glyph: "🚁", hue: 350,
    blurb: "Two-channel infrared micro helicopter with Spidey livery. Charges via USB.",
    description:
      "A ready-to-fly 2-channel indoor helicopter decked in Spider-Man colours. Gyro-stabilised for easy hover, USB rechargeable, with a full-function IR controller. Great starter flyer for ages 8+."
  },
  {
    id: "dragon-egg-3dprint",
    name: '3D Printed 12" Dragon and 6" Egg Set',
    brand: "PowerTRC", price: 13.98, category: "toys", sub: "Dinosaurs!",
    tags: ["3d-print", "articulated", "fidget"], rating: 4.6, reviews: 128,
    inStock: true, glyph: "🐉", hue: 130,
    blurb: "Fully articulated print-in-place dragon that curls around its own crystal egg.",
    description:
      "A 12-inch articulated dragon printed in one piece — every segment moves — paired with a 6-inch crystal egg. Satisfying desk fidget and a striking shelf piece. Colours vary; each is unique."
  },
  {
    id: "crystal-dragon-large",
    name: "3D Printed Articulated Crystal Dragon with Wings (Large)",
    brand: "PowerTRC", price: 6.99, category: "toys", sub: "Dinosaurs!",
    tags: ["3d-print", "articulated", "budget"], rating: 4.5, reviews: 210,
    inStock: true, badge: "Under $10", glyph: "🐲", hue: 285,
    blurb: "Wing-spread crystal dragon with a whip-flick articulated tail.",
    description:
      "A large print-in-place crystal dragon with fanned wings and a fully articulated spine. Flexible filament means it flops, curls and poses. A perennial best-seller at pocket-money pricing."
  },
  {
    id: "flex-dinos-multicolor",
    name: "3D Printed Flexible Articulated Dinosaurs (Large, Multi-Colour)",
    brand: "PowerTRC", price: 6.99, category: "toys", sub: "Dinosaurs!",
    tags: ["3d-print", "articulated", "party"], rating: 4.4, reviews: 174,
    inStock: true, glyph: "🦕", hue: 95,
    blurb: "Rainbow-marble T-Rex and raptor prints that actually wiggle.",
    description:
      "Large flexible dinosaur prints in randomised multi-colour marble filament. The segmented body flexes end to end for a lifelike slither. Sold individually; species and colourway vary."
  },
  {
    id: "rainbow-blossom-dragons",
    name: "3D Printed Rainbow Blossom Dragons",
    brand: "PowerTRC", price: 10.99, category: "toys", sub: "Dinosaurs!",
    tags: ["3d-print", "articulated"], rating: 4.7, reviews: 66,
    inStock: true, glyph: "🌸", hue: 320,
    blurb: "Silk-gradient articulated dragons with a soft floral shimmer.",
    description:
      "Printed in silk multi-colour filament that shifts through blossom pinks, corals and jade as the light moves. Fully articulated from snout to tail tip."
  },
  {
    id: "safari-pullback-trucks",
    name: "4-Pack Safari Animal Pull-Back Trucks",
    brand: "BARSUPPLY", price: 19.99, compareAt: 29.99, category: "toys", sub: "Little Rebels",
    tags: ["kids", "vehicles", "sale"], rating: 4.3, reviews: 58,
    inStock: true, badge: "Sale", glyph: "🚚", hue: 25,
    blurb: "Four chunky friction trucks, each carrying a different safari beast.",
    description:
      "A set of four toddler-friendly pull-back trucks, each hauling a removable safari animal. No batteries — pull back and release for a zippy launch. Rounded edges for little hands."
  },
  {
    id: "motu-he-man-origins",
    name: 'Masters of the Universe Origins — He-Man 5.5" Deluxe Figure',
    brand: "Mattel", price: 22.99, category: "toys", sub: "Masters of the Universe",
    tags: ["figure", "origins", "retro"], rating: 4.7, reviews: 84,
    inStock: true, glyph: "🗡️", hue: 40,
    blurb: "The most powerful man in the universe with Power Sword, axe, shield and mini-comic.",
    description:
      "MOTU Origins blends vintage 1982 proportions with modern articulation. He-Man arrives with the Power Sword (half and full), battle axe, shield and a collectible mini-comic."
  },
  {
    id: "motu-skeletor-origins",
    name: 'Masters of the Universe Origins — Skeletor 5.5" Deluxe Figure',
    brand: "Mattel", price: 22.99, category: "toys", sub: "Masters of the Universe",
    tags: ["figure", "origins", "villain"], rating: 4.6, reviews: 77,
    inStock: true, glyph: "💀", hue: 275,
    blurb: "Lord of Destruction with Havoc Staff, half Power Sword and mini-comic.",
    description:
      "Skeletor rules Snake Mountain in classic Origins style — vintage sculpt, modern joints, Havoc Staff, half Power Sword and mini-comic included."
  },
  {
    id: "stranger-things-demogorgon",
    name: 'Stranger Things — Demogorgon 7" Deluxe Figure',
    brand: "McFarlane Toys", price: 29.99, category: "toys", sub: "Stranger Things",
    tags: ["figure", "7-inch", "horror"], rating: 4.5, reviews: 69,
    inStock: true, glyph: "🌀", hue: 350,
    blurb: "Petal-faced predator from the Upside Down with articulated maw.",
    description:
      "A 7-inch Demogorgon with a fully articulating flower-head jaw, extra hands and an Upside Down base wrapped in vine tendrils. Includes collectible art card."
  },
  {
    id: "stranger-things-tee",
    name: "Stranger Things x DinoFam — Hawkins Raptor League Tee",
    brand: "DinoFam", price: 27.0, category: "shwag", sub: "Men's Apparel",
    tags: ["tee", "apparel", "crossover"], rating: 4.8, reviews: 41,
    inStock: true, badge: "Crossover", glyph: "👕", hue: 350,
    blurb: "Varsity-style raptor mascot on a heavyweight cotton tee. Unisex fit.",
    description:
      "A soft, heavyweight 100% ring-spun cotton tee with a distressed 'Hawkins Raptor League' varsity print. Unisex sizing S–3XL, screen-printed to order."
  },
  {
    id: "blokees-galaxy-dino",
    name: "Blokees Galaxy Version — Build-a-Dino Blind Box (Single)",
    brand: "Blokees", price: 8.99, category: "toys", sub: "Blokees",
    tags: ["model-kit", "blind-box", "buildable"], rating: 4.4, reviews: 112,
    inStock: true, glyph: "📦", hue: 200,
    blurb: "Snap-together articulated mini-model — nine to collect, one at random.",
    description:
      "No glue, no tools — punch out the runner and snap together a poseable mini-dino. Nine designs in the Galaxy series including a guaranteed-rare chrome raptor. Sold as a single sealed blind box."
  },
  {
    id: "blokees-galaxy-case",
    name: "Blokees Galaxy Version — Build-a-Dino Full Case (9 Boxes)",
    brand: "Blokees", price: 71.99, compareAt: 80.91, category: "toys", sub: "Blokees",
    tags: ["model-kit", "case", "buildable", "sale"], rating: 4.7, reviews: 38,
    inStock: true, badge: "Full Set", glyph: "🗃️", hue: 205,
    blurb: "A sealed case of nine — collect the complete Galaxy set including the chrome chase.",
    description:
      "A factory-sealed case containing all nine Galaxy Version designs, so you complete the set in one purchase — chrome raptor chase included. Priced below nine singles."
  },
  {
    id: "retro-cart-cleaner",
    name: "Retro Games — 72-Pin Cartridge Cleaning Kit",
    brand: "DinoMart", price: 12.99, category: "toys", sub: "Retro Games",
    tags: ["accessory", "restore", "8-bit"], rating: 4.6, reviews: 90,
    inStock: true, glyph: "🎮", hue: 15,
    blurb: "Bring blinking grey carts back to life. Brushes, swabs and a bit driver included.",
    description:
      "Everything you need to revive a dusty cartridge library: 3.8mm and 4.5mm security bits, fibre-tip pens, lint-free swabs, isopropyl-ready brushes and a microfibre cloth in a zip case."
  },
  {
    id: "retro-console-shell",
    name: "Retro Games — Ember Edition Handheld Shell Replacement",
    brand: "DinoMart", price: 18.99, category: "toys", sub: "Retro Games",
    tags: ["accessory", "modding", "custom"], rating: 4.3, reviews: 27,
    inStock: false, glyph: "🕹️", hue: 20,
    blurb: "Translucent fire-orange replacement shell with jungle-green buttons.",
    description:
      "A pre-cut replacement housing for classic pocket handhelds in translucent ember orange, bundled with a set of jungle-green buttons, screwdriver and light pipe. Restock incoming."
  },
  {
    id: "kpdh-huntrix-figure",
    name: 'K-Pop Demon Hunters — HUNTR/X Stage 6" Figure 3-Pack',
    brand: "DinoMart", price: 44.99, category: "toys", sub: "K-Pop Demon Hunters",
    tags: ["figure", "boxset", "music"], rating: 4.8, reviews: 63,
    inStock: true, badge: "New", glyph: "🎤", hue: 300, featured: true,
    blurb: "The full trio in stage regalia with mic, blade and light-stick accessories.",
    description:
      "A boxed set of three 6-inch figures in full stage-and-battle regalia, each with swappable hands, a signature weapon and a snap-in light-stick. Backdrop diorama panel included."
  },
  {
    id: "kpdh-vinyl-ost",
    name: "K-Pop Demon Hunters — Original Soundtrack (Ember Splatter Vinyl)",
    brand: "DinoMart", price: 34.99, category: "toys", sub: "K-Pop Demon Hunters",
    tags: ["vinyl", "music", "limited"], rating: 4.9, reviews: 51,
    inStock: true, badge: "Limited", glyph: "💿", hue: 310,
    blurb: "180g fire-and-jade splatter LP with gatefold art and lyric insert.",
    description:
      "The complete soundtrack pressed on 180-gram ember-and-jade splatter vinyl. Gatefold sleeve, printed inner, foil-stamped lyric insert. Limited to a single pressing."
  },
  {
    id: "raptor-league-hoodie",
    name: "DinoFam — Raptor League Heavyweight Hoodie",
    brand: "DinoFam", price: 58.0, category: "shwag", sub: "Men's Apparel",
    tags: ["hoodie", "apparel", "core"], rating: 4.8, reviews: 137,
    inStock: true, badge: "Core", glyph: "🧥", hue: 140, featured: true,
    blurb: "400gsm brushed-fleece hoodie, embroidered raptor crest, ember-tipped drawcords.",
    description:
      "Our flagship hoodie in 400gsm brushed-back fleece with a tonal embroidered raptor crest, ember-tipped metal-aglet drawcords and a kangaroo pocket. Boxy unisex fit; size down for classic."
  },
  {
    id: "vibejurassic-womens-crop",
    name: "DinoFam — #VibeJurassic Women's Cropped Tee",
    brand: "DinoFam", price: 26.0, category: "shwag", sub: "Women's Apparel",
    tags: ["tee", "apparel", "cropped"], rating: 4.6, reviews: 58,
    inStock: true, glyph: "👚", hue: 150,
    blurb: "Relaxed crop with a puff-print #VibeJurassic wordmark.",
    description:
      "A relaxed cropped tee in combed cotton with a soft puff-print #VibeJurassic wordmark across the chest. Pre-shrunk; sizes XS–2XL."
  },
  {
    id: "lil-raptor-kids-set",
    name: "DinoFam — Lil' Raptor Kids Tee + Sticker Pack",
    brand: "DinoFam", price: 22.0, category: "shwag", sub: "Kid's Apparel",
    tags: ["kids", "apparel", "bundle"], rating: 4.9, reviews: 44,
    inStock: true, badge: "Bundle", glyph: "🦖", hue: 95,
    blurb: "Soft kids' tee with a friendly cartoon raptor, plus a 12-piece sticker sheet.",
    description:
      "A gentle-wash kids' tee (ages 2–12) featuring the friendly Lil' Raptor character, bundled with a die-cut 12-piece sticker sheet for backpacks and water bottles."
  },
  {
    id: "dino-camp-mug",
    name: "DinoMart — Ember Camp Enamel Mug 12oz",
    brand: "DinoMart", price: 16.0, category: "shwag", sub: "Household Items",
    tags: ["homeware", "mug", "enamel"], rating: 4.7, reviews: 71,
    inStock: true, glyph: "☕", hue: 20,
    blurb: "Speckled enamel camp mug with a wrap-around fossil-dig illustration.",
    description:
      "A 12oz carbon-steel enamel mug with a fire-orange rim, cream speckle body and a wrap-around line illustration of a fossil dig. Camp, desk or shelf. Not microwave safe."
  },
  {
    id: "dino-fossil-blanket",
    name: "DinoMart — Fossil Record Woven Throw Blanket",
    brand: "DinoMart", price: 64.0, category: "shwag", sub: "Household Items",
    tags: ["homeware", "blanket", "woven"], rating: 4.8, reviews: 39,
    inStock: true, glyph: "🛋️", hue: 135,
    blurb: "Jacquard-woven cotton throw mapping raptor and T-Rex skeletons in jade on charcoal.",
    description:
      "A 50\" x 60\" jacquard-woven cotton throw with fringed edges, mapping a museum-style fossil record in jade green on charcoal. Reversible; machine washable cold."
  },
  {
    id: "limited-ember-raptor-statue",
    name: "Limited Edition — Ember Raptor 10\" Resin Statue (Numbered /500)",
    brand: "DinoFam", price: 149.0, category: "shwag", sub: "Limited Editions",
    tags: ["statue", "resin", "numbered", "grail"], rating: 5.0, reviews: 18,
    inStock: true, badge: "Numbered /500", glyph: "🗿", hue: 15, featured: true,
    drop: "2026-09-20T16:00:00Z",
    blurb: "Hand-finished resin raptor mid-leap, ember-gradient wash, numbered base.",
    description:
      "A hand-cast, hand-painted 10-inch resin statue of a raptor caught mid-leap, finished with a signature ember-to-jade gradient wash and mounted on a numbered basalt-look base. Edition of 500; each ships with a signed certificate."
  },
  {
    id: "limited-founders-coin",
    name: "Limited Edition — DinoFam Founder's Challenge Coin",
    brand: "DinoFam", price: 25.0, category: "shwag", sub: "Limited Editions",
    tags: ["collectible", "coin", "numbered"], rating: 4.9, reviews: 62,
    inStock: true, badge: "Limited", glyph: "🪙", hue: 45,
    blurb: "Dual-plated challenge coin — jungle-green obverse, fire-bronze reverse.",
    description:
      "A 2-inch die-struck challenge coin, dual-plated with a jungle-green enamel obverse raptor crest and a fire-bronze reverse bearing the DinoFam motto. Capsule and stand included."
  },
  {
    id: "mcfarlane-trex-museum",
    name: 'McFarlane Toys — T-Rex "Museum Collection" Painted Figure',
    brand: "McFarlane Toys", price: 44.99, category: "toys", sub: "McFarlane Toys",
    tags: ["figure", "dinosaur", "display"], rating: 4.7, reviews: 55,
    inStock: true, badge: "New", glyph: "🦖", hue: 130,
    blurb: 'Scientifically posed 12" tip-to-tail tyrannosaur with feather-detail sculpt.',
    description:
      "A collector-grade painted T-Rex from McFarlane's Museum Collection, roughly 12 inches tip to tail, with proto-feather sculpt detail, a hunting stance and a branded display base."
  },
  {
    id: "mcfarlane-raptor-pack",
    name: "McFarlane Toys — Velociraptor Pack 2-Figure Set",
    brand: "McFarlane Toys", price: 39.99, category: "toys", sub: "McFarlane Toys",
    tags: ["figure", "dinosaur", "twin-pack"], rating: 4.6, reviews: 34,
    inStock: true, glyph: "🦅", hue: 120,
    blurb: "Two poseable pack-hunter raptors with interchangeable heads and a shared base.",
    description:
      "A twin pack of poseable Velociraptors mid-hunt, each with an alternate head sculpt, gripping feet for perching and a shared diorama base with foliage."
  },
  {
    id: "marvel-legends-storm",
    name: 'Marvel Legends Series — Storm 6" Figure (X-Men \'97)',
    brand: "Hasbro", price: 26.99, category: "toys", sub: "Marvel",
    tags: ["figure", "6-inch", "x-men"], rating: 4.8, reviews: 102,
    inStock: true, glyph: "⛈️", hue: 265,
    blurb: "Animated-accurate Storm with cape, lightning effects and two head sculpts.",
    description:
      "Storm in her X-Men '97 animated deco with a fabric-look cape, glued-in and swappable calm/glowing-eye head sculpts and a pair of lightning blast effects."
  },
  {
    id: "marvel-legends-wolverine",
    name: 'Marvel Legends Series — Wolverine 6" Figure (Tiger Stripe)',
    brand: "Hasbro", price: 24.99, category: "toys", sub: "Marvel",
    tags: ["figure", "6-inch", "x-men"], rating: 4.7, reviews: 118,
    inStock: false, glyph: "🐾", hue: 40,
    blurb: "Classic tiger-stripe Logan with mask-on/mask-off heads and claw effects.",
    description:
      "The fan-favourite tiger-stripe costume with unmasked and masked head sculpts, berserker-claw effect pieces and full articulation. Currently between restocks — join the waitlist."
  },
  {
    id: "dc-multiverse-flash",
    name: 'DC Multiverse — The Flash (Wally West) 7" Figure',
    brand: "McFarlane Toys", price: 24.99, category: "toys", sub: "DC Comics",
    tags: ["figure", "7-inch"], rating: 4.5, reviews: 47,
    inStock: true, glyph: "⚡", hue: 15,
    blurb: "Speed-Force trail effect, running stance and collectible base.",
    description:
      "Wally West mid-sprint with a translucent Speed-Force trail effect that clips to the ankle, plus alternate hands, art card and figure base."
  },
  {
    id: "dc-batmobile-diecast",
    name: "DC — Ember Patrol Batmobile 1:32 Die-Cast",
    brand: "DinoMart", price: 32.99, category: "toys", sub: "DC Comics",
    tags: ["vehicle", "diecast", "custom"], rating: 4.4, reviews: 29,
    inStock: true, glyph: "🏎️", hue: 10,
    blurb: "Custom 'Ember Patrol' colourway die-cast with free-rolling wheels and opening canopy.",
    description:
      "A 1:32 die-cast Batmobile in an exclusive fire-black 'Ember Patrol' livery with jungle-green underglow paint, free-rolling wheels and an opening cockpit canopy."
  },
  {
    id: "transformers-optimus-core",
    name: "Transformers Legacy — Core Class Optimus Prime",
    brand: "Hasbro", price: 14.99, category: "toys", sub: "Transformers",
    tags: ["figure", "converting", "core-class"], rating: 4.6, reviews: 88,
    inStock: true, badge: "Under $15", glyph: "🚛", hue: 210,
    blurb: "Pocket-size Prime, 9-step conversion, cab-to-robot with blaster.",
    description:
      "A Core Class Optimus Prime that converts from cab to robot in nine steps, includes a blaster accessory and scales perfectly with Legacy Core Class figures."
  },
  {
    id: "transformers-bumblebee-td",
    name: "Transformers Legacy — Deluxe Class Bumblebee",
    brand: "Hasbro", price: 21.99, category: "toys", sub: "Transformers",
    tags: ["figure", "converting", "deluxe"], rating: 4.7, reviews: 64,
    inStock: true, glyph: "🐝", hue: 48,
    blurb: "Deluxe Class 'Bee, 16-step conversion, twin blasters and battle mask.",
    description:
      "Bumblebee in Deluxe Class scale with a 16-step conversion, two blaster accessories and a swappable battle-mask head sculpt."
  },
  {
    id: "mtg-foundations-bundle",
    name: "Magic: The Gathering — Foundations Bundle (Gift Edition)",
    brand: "Wizards of the Coast", price: 49.99, category: "toys", sub: "Magic: The Gathering",
    tags: ["tcg", "sealed", "bundle"], rating: 4.7, reviews: 76,
    inStock: true, glyph: "🎁", hue: 255,
    blurb: "Nine Play Boosters, foil promo, 40 lands, spindown and a storage box.",
    description:
      "The Foundations Gift Edition bundle: nine Play Boosters, an alternate-art foil promo card, 40 lands (20 foil), a spindown life counter and a collector storage box with a lift-out tray."
  },
  {
    id: "mtg-commander-jungle",
    name: "Magic: The Gathering — Jurassic Jungle Commander Deck",
    brand: "Wizards of the Coast", price: 44.99, category: "toys", sub: "Magic: The Gathering",
    tags: ["tcg", "commander", "preconstructed"], rating: 4.5, reviews: 40,
    inStock: true, glyph: "🌿", hue: 130,
    blurb: "100-card ready-to-play dinosaur tribal Commander deck with foil commander.",
    description:
      "A 100-card ready-to-play Commander deck built around big-stompy dinosaur tribal synergies, including a foil-etched legendary commander, a life wheel and a deck box."
  },
  {
    id: "funko-pop-trex-flocked",
    name: "Jurassic Park — T-Rex Funko Pop! (Flocked, 6\" Super-Sized)",
    brand: "Funko", price: 29.99, category: "toys", sub: "Funko Pop!",
    tags: ["funko", "flocked", "super-sized"], rating: 4.8, reviews: 95,
    inStock: true, badge: "Flocked", glyph: "🦖", hue: 110,
    blurb: "Six-inch fuzzy flocked tyrannosaur mid-roar. Shelf presence: maximum.",
    description:
      "A super-sized 6-inch Jurassic Park T-Rex with a soft flocked coat, roaring pose and window-box packaging. A centrepiece for any dino shelf."
  },
  {
    id: "little-rebels-dig-kit",
    name: "Little Rebels — Junior Paleontologist Dig Kit",
    brand: "DinoMart", price: 24.99, category: "toys", sub: "Little Rebels",
    tags: ["kids", "stem", "activity"], rating: 4.6, reviews: 81,
    inStock: true, badge: "STEM", glyph: "⛏️", hue: 35,
    blurb: "Excavate a buildable raptor skeleton from a plaster block. Tools and guidebook included.",
    description:
      "A STEM activity kit: chip and brush a 12-piece raptor skeleton out of a plaster block, then assemble it. Includes chisel, brush, safety goggles, tray and an illustrated fact guidebook. Ages 6+."
  },
  {
    id: "little-rebels-nightlight",
    name: "Little Rebels — Ember Egg Colour-Change Night Light",
    brand: "DinoMart", price: 19.99, category: "shwag", sub: "Household Items",
    tags: ["kids", "homeware", "light"], rating: 4.7, reviews: 53,
    inStock: true, glyph: "🥚", hue: 25,
    blurb: "Silicone dino-egg lamp that cycles ember-orange to jungle-green. USB-C, tap to dim.",
    description:
      "A squishable food-grade silicone egg light that slowly cycles from ember orange to jungle green, or holds a colour. Tap to cycle brightness, USB-C rechargeable, 8-hour runtime."
  },
  {
    id: "dinofam-dad-cap",
    name: "DinoFam — Fossil Crest Dad Cap",
    brand: "DinoFam", price: 24.0, category: "shwag", sub: "Men's Apparel",
    tags: ["hat", "apparel"], rating: 4.6, reviews: 37,
    inStock: true, glyph: "🧢", hue: 140,
    blurb: "Unstructured 6-panel cap, tonal embroidered fossil crest, antique-brass buckle.",
    description:
      "A low-profile unstructured 6-panel cap in washed cotton twill with a tonal embroidered fossil crest, curved brim and antique-brass slide buckle. One size, adjustable."
  },
  {
    id: "dinofam-socks-2pack",
    name: "DinoFam — Ember & Jungle Crew Socks (2-Pack)",
    brand: "DinoFam", price: 16.0, category: "shwag", sub: "Toys & Games",
    tags: ["apparel", "socks", "bundle"], rating: 4.5, reviews: 48,
    inStock: true, glyph: "🧦", hue: 30,
    blurb: "Combed-cotton crew socks — one ember raptor pair, one jungle fossil pair.",
    description:
      "A two-pack of cushioned combed-cotton crew socks with reinforced heel and toe: one ember-orange raptor jacquard, one jungle-green fossil pattern. Men's 8–13."
  },
  {
    id: "dino-desk-dice",
    name: "DinoMart — Fossil Resin Polyhedral Dice Set (7-Piece)",
    brand: "DinoMart", price: 21.0, category: "shwag", sub: "Toys & Games",
    tags: ["dice", "ttrpg", "resin"], rating: 4.8, reviews: 59,
    inStock: true, glyph: "🎲", hue: 135,
    blurb: "Hand-inked resin dice with suspended 'amber' flecks and gold numerals.",
    description:
      "A full 7-piece polyhedral set cast in translucent jade resin with suspended ember-amber flecks and hand-inked gold numerals. Comes in a drawstring pouch. Sharp-edged, factory QC'd."
  },
  {
    id: "dino-puzzle-1000",
    name: "DinoMart — \"Cretaceous Dawn\" 1000-Piece Jigsaw Puzzle",
    brand: "DinoMart", price: 22.0, category: "shwag", sub: "Toys & Games",
    tags: ["puzzle", "family"], rating: 4.7, reviews: 45,
    inStock: true, glyph: "🧩", hue: 20,
    blurb: "1000 pieces of a fiery Cretaceous sunrise over a raptor-dotted valley.",
    description:
      "A 1000-piece jigsaw on linen-finish board, 27\" x 20\" assembled, depicting a fiery Cretaceous dawn breaking over a valley of raptors and long-necks. Includes a folded poster reference."
  }
];

/* ---- Brand list for the marquee --------------------------------------------- */
DINO.brands = [
  "Hasbro", "Funko", "McFarlane Toys", "Wizards of the Coast", "Mattel",
  "Loungefly", "Blokees", "World Tech Toys", "PowerTRC", "DinoFam"
];

/* ---- Testimonials ---------------------------------------------------------- */
DINO.testimonials = [
  { name: "Marisol V.", role: "DinoFam since day one", stars: 5,
    quote: "Ordered Friday, on my shelf Monday. The Digital Dinoflage T-Rex is even better in person — this is the only shop I trust for chases now." },
  { name: "Deshawn P.", role: "Funko grail hunter", stars: 5,
    quote: "They actually guaranteed the Chase variant and it arrived mint in a hard case. Packaging game is unreal." },
  { name: "Kenji T.", role: "MTG playgroup organiser", stars: 5,
    quote: "Booster box pricing beat my local, tracking was accurate to the hour, and the box was factory sealed. Buying our next set here." },
  { name: "Abby R.", role: "Raptor League hoodie owner", stars: 4,
    quote: "Heaviest hoodie I own and the embroidery hasn't budged after 20 washes. Runs boxy — size down like they say." }
];

/* ---- FAQ ----------------------------------------------------------------- */
DINO.faq = [
  { q: "How fast do orders ship?",
    a: "In-stock orders leave our warehouse in 1–2 business days. You'll get a tracking number by email the moment your label is printed." },
  { q: "Is everything authentic?",
    a: "Always. DinoMart only sells genuine, officially licensed merchandise sourced from authorised distributors and manufacturers. No bootlegs, ever." },
  { q: "What's your return policy?",
    a: "Unopened items can be returned within 30 days for a full refund. Defective or damaged-in-transit items are replaced free — just send a photo to sales@dinofam.io." },
  { q: "Do you guarantee Funko Chase variants?",
    a: "When a listing says 'Chase Variant', that's what ships — the 1-in-6 rare, not a random pull. Common listings ship the common." },
  { q: "Do you ship internationally?",
    a: "Yes — we ship to 27+ countries with prices shown in your local currency at checkout. Duties and taxes are calculated at checkout where available." },
  { q: "What does 'a portion of profits' support?",
    a: "A share of every sale funds vetted partners providing housing, food and job resources for veterans and families in need. We publish an annual impact recap." }
];
