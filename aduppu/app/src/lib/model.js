// Aduppu data model: cuisine taxonomy, diet mapping, seed dishes, item helpers.

// ---------------------------------------------------------------------------
// Cuisine taxonomy (two-level: region + optional sub-cuisines)
// ---------------------------------------------------------------------------
export const CUISINES = [
  { key: 'tamil-nadu', label: 'Tamil Nadu', subs: [
      { key: 'tamil-nadu:chettinad', label: 'Chettinad' },
      { key: 'tamil-nadu:kongunad',  label: 'Kongunad' },
      { key: 'tamil-nadu:madurai',   label: 'Madurai' },
      { key: 'tamil-nadu:thanjavur', label: 'Thanjavur / Delta' },
  ]},
  { key: 'kerala', label: 'Kerala', subs: [
      { key: 'kerala:malabar',    label: 'Malabar' },
      { key: 'kerala:travancore', label: 'Travancore' },
      { key: 'kerala:central',    label: 'Central Kerala / Kochi' },
      { key: 'kerala:palakkad',   label: 'Palakkad' },
  ]},
  { key: 'karnataka', label: 'Karnataka', subs: [
      { key: 'karnataka:udupi-mangalore', label: 'Udupi–Mangalore' },
      { key: 'karnataka:north',           label: 'North Karnataka' },
      { key: 'karnataka:malnad',          label: 'Malnad' },
      { key: 'karnataka:kodava',          label: 'Kodava / Coorg' },
  ]},
  { key: 'andhra',    label: 'Andhra' },
  { key: 'telangana', label: 'Telangana', subs: [
      { key: 'telangana:hyderabadi', label: 'Hyderabadi' },
  ]},
  { key: 'goan',      label: 'Goan' },
  { key: 'punjabi',   label: 'Punjabi' },
  { key: 'bengali',   label: 'Bengali' },
  { key: 'marathi',   label: 'Marathi' },
  { key: 'gujarati',  label: 'Gujarati' },
  { key: 'rajasthani',label: 'Rajasthani' },
  { key: 'kashmiri',  label: 'Kashmiri' },
  { key: 'other',     label: 'Other' },
];

// ---------------------------------------------------------------------------
// expandCuisines: selection semantics
// A region key covers the region + all its sub keys.
// A region:sub key covers that sub + its parent region key.
// ---------------------------------------------------------------------------
export function expandCuisines(selectedKeys) {
  const result = new Set();
  for (const key of selectedKeys) {
    result.add(key);
    if (key.includes(':')) {
      // Sub-cuisine: also include parent region
      result.add(key.split(':')[0]);
    } else {
      // Region: also include all sub-cuisines
      const region = CUISINES.find((c) => c.key === key);
      if (region?.subs) {
        for (const sub of region.subs) result.add(sub.key);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Diet mapping
// ---------------------------------------------------------------------------
export const DIET_ALLOWED = {
  veg: ['veg'],
  'veg-egg': ['veg', 'egg'],
  all: ['veg', 'egg', 'nonveg'],
};

// ---------------------------------------------------------------------------
// Seed dish catalogs (per cuisine key)
// Each dish: { name, diet: 'veg'|'egg'|'nonveg', ingredients: [...], tags: [], ref: '', notes: '' }
// Grouped under breakfast/lunch/dinner arrays per cuisine key.
// ---------------------------------------------------------------------------
const D = (name, diet, ingredients, tags = []) => ({ name, diet, ingredients, tags, ref: '', notes: '' });
const V = (name, ing, tags) => D(name, 'veg', ing, tags);
const E = (name, ing, tags) => D(name, 'egg', ing, tags);
const N = (name, ing, tags) => D(name, 'nonveg', ing, tags);

// ---------------------------------------------------------------------------
// Canonical ingredient vocabulary (172 unique names across all seeds)
// ---------------------------------------------------------------------------
// Grains & flours:   rice, basmati rice, black rice, mappillai samba rice,
//   rice flour, wheat flour, maida, jowar flour, bajra flour, ragi flour,
//   rava, broken wheat, wheat, poha, vermicelli, sabudana, bhajani flour,
//   rice wafer, maize flour
// Dals & legumes:    toor dal, urad dal, moong dal, chana dal, green moong dal,
//   chickpea, black chickpea, rajma, horse gram, red cow pea, black-eyed pea,
//   moth bean sprout, sprouted moth, flat beans, surti papdi
// Vegetables:        potato, onion, tomato, shallot, eggplant, okra, drumstick,
//   carrot, cabbage, cauliflower, french beans, green pea, pumpkin, ash gourd,
//   bitter gourd, bottle gourd, chow chow, ivy gourd, raw banana, spinach,
//   malabar spinach, mustard green, bamboo shoot, cucumber, banana flower,
//   raw mango, beetroot, radish, turnip, lotus stem, mixed vegetable,
//   collard green, mushroom, yam, purple yam
// Fruits:            banana, ripe banana, coconut, pomegranate, tapioca
// Meat & fish:       chicken, mutton, mutton keema, beef, pork, fish, prawn,
//   mussel, egg, egg yolk
// Dairy:             curd, milk, cream, butter, ghee, paneer, khoya
// Nuts & seeds:      peanut, cashew, sesame, dry fruit, raisin, poppy seed
// Spices (whole):    cumin, pepper, mustard, fennel, fenugreek, coriander seed,
//   cardamom, cinnamon, clove, star anise, carom seed, saffron, nutmeg,
//   kalpasi, bay leaf
// Spices (ground):   turmeric, red chilli, green chilli, chilli powder,
//   red chilli powder, kashmiri chilli, ginger, ginger powder, garlic,
//   coriander, asafoetida
// Herbs & leaves:    curry leaves, mint, kasuri methi, fenugreek leaf,
//   gongura leaf, panch phoron
// Spice mixes:       sambar powder, biryani masala, garam masala, goda masala,
//   chole masala, kolhapuri masala, bisi bele bath powder, vangi bath powder,
//   kuzhambu powder, mustard paste, methi muthia
// Oils & fats:       oil, ghee, butter, cream
// Souring agents:    tamarind, lemon, lime, kokum, kodampuli, kachampuli,
//   vinegar, amchur
// Sweeteners:        sugar, jaggery
// Liquids & misc:    water, salt, coconut milk, toddy, soy sauce, baking soda,
//   citric acid, yeast
// Breads & prepared: pao bread, pav, bread, papad, sev, farsan,
//   banana leaf
// ---------------------------------------------------------------------------

export const SEEDS = {
  // =========================================================================
  // TAMIL NADU — everyday home cooking
  // =========================================================================
  'tamil-nadu': {
    breakfast: [
      V('Idli with Sambar', ['rice', 'urad dal', 'toor dal', 'tamarind', 'drumstick', 'sambar powder'], ['comfort']),
      V('Masala Dosa', ['rice', 'urad dal', 'potato', 'onion', 'mustard', 'turmeric', 'oil'], ['popular']),
      V('Plain Dosa with Coconut Chutney', ['rice', 'urad dal', 'coconut', 'green chilli', 'oil']),
      V('Ven Pongal', ['rice', 'moong dal', 'ghee', 'pepper', 'cumin', 'ginger', 'cashew', 'curry leaves'], ['comfort']),
      V('Rava Upma', ['rava', 'onion', 'green chilli', 'mustard', 'urad dal', 'curry leaves', 'oil'], ['quick']),
      V('Semiya Upma', ['vermicelli', 'onion', 'green chilli', 'mustard', 'curry leaves', 'peanut', 'oil'], ['quick']),
      V('Idiyappam with Coconut Milk', ['rice flour', 'coconut milk', 'salt'], ['comfort']),
      V('Poori with Potato Masala', ['wheat flour', 'potato', 'onion', 'turmeric', 'mustard', 'oil']),
      V('Adai with Aviyal', ['rice', 'chana dal', 'urad dal', 'toor dal', 'red chilli', 'curry leaves', 'coconut']),
      V('Onion Rava Dosa', ['rava', 'rice flour', 'maida', 'onion', 'green chilli', 'cumin', 'pepper', 'oil'], ['quick']),
      V('Paniyaram', ['rice', 'urad dal', 'onion', 'carrot', 'curry leaves', 'oil'], ['quick']),
      E('Egg Dosa', ['rice', 'urad dal', 'egg', 'onion', 'green chilli', 'oil']),
    ],
    lunch: [
      V('Sambar Rice', ['rice', 'toor dal', 'drumstick', 'tomato', 'tamarind', 'onion', 'sambar powder', 'oil'], ['rice', 'comfort']),
      V('Rasam Rice', ['rice', 'tomato', 'tamarind', 'pepper', 'cumin', 'garlic', 'mustard', 'curry leaves'], ['rice', 'comfort']),
      V('Curd Rice', ['rice', 'curd', 'mustard', 'urad dal', 'curry leaves', 'ginger', 'pomegranate'], ['rice', 'cooling']),
      V('Lemon Rice', ['rice', 'lemon', 'turmeric', 'peanut', 'mustard', 'curry leaves', 'chana dal'], ['rice', 'quick']),
      V('Tamarind Rice (Puliyodarai)', ['rice', 'tamarind', 'peanut', 'mustard', 'curry leaves', 'sesame', 'fenugreek'], ['rice']),
      V('Tomato Rice', ['rice', 'tomato', 'onion', 'ginger', 'garlic', 'mint', 'ghee'], ['rice', 'one-pot']),
      V('Coconut Rice', ['rice', 'coconut', 'cashew', 'urad dal', 'chana dal', 'curry leaves'], ['rice', 'quick']),
      V('Kara Kuzhambu with Rice', ['rice', 'tamarind', 'shallot', 'tomato', 'coconut', 'kuzhambu powder', 'oil'], ['rice', 'curry']),
      V('Mor Kuzhambu with Rice', ['rice', 'curd', 'coconut', 'cumin', 'green chilli', 'turmeric', 'ash gourd'], ['rice', 'cooling']),
      V('Kootu with Rice', ['rice', 'chow chow', 'coconut', 'chana dal', 'mustard', 'cumin', 'curry leaves'], ['rice', 'curry']),
      V('Paruppu Rice', ['rice', 'toor dal', 'ghee', 'pepper', 'cumin', 'mustard'], ['rice', 'comfort']),
      V('Beetroot Poriyal', ['beetroot', 'coconut', 'mustard', 'urad dal', 'curry leaves'], ['side']),
      V('Beans Paruppu Usili', ['french beans', 'toor dal', 'red chilli', 'curry leaves', 'coconut'], ['side']),
      V('Vendakkai Poriyal', ['okra', 'coconut', 'mustard', 'urad dal', 'curry leaves', 'oil'], ['side']),
      E('Egg Curry with Rice', ['rice', 'egg', 'onion', 'tomato', 'ginger', 'garlic', 'turmeric', 'coriander powder'], ['rice', 'curry']),
    ],
    dinner: [
      V('Chapati with Veg Kurma', ['wheat flour', 'mixed vegetable', 'coconut milk', 'onion', 'tomato', 'fennel'], ['roti']),
      V('Mini Tiffin (Idli + Dosa)', ['rice', 'urad dal', 'coconut', 'green chilli', 'sambar powder'], ['tiffin']),
      V('Ven Pongal (Dinner)', ['rice', 'moong dal', 'ghee', 'pepper', 'cumin', 'ginger', 'curry leaves'], ['comfort']),
      V('Parotta with Salna', ['wheat flour', 'oil', 'onion', 'tomato', 'coconut milk', 'fennel', 'chilli powder'], ['roti']),
      V('Uttapam', ['rice', 'urad dal', 'onion', 'tomato', 'carrot', 'green chilli', 'oil'], ['tiffin']),
      V('Semiya Bath', ['vermicelli', 'onion', 'tomato', 'green pea', 'carrot', 'mustard', 'curry leaves', 'oil'], ['quick']),
      V('Chapati with Potato Masala', ['wheat flour', 'potato', 'onion', 'turmeric', 'mustard', 'curry leaves'], ['roti']),
      E('Egg Parotta', ['wheat flour', 'egg', 'onion', 'green chilli', 'oil'], ['roti']),
      N('Kothu Parotta', ['wheat flour', 'chicken', 'egg', 'onion', 'curry leaves', 'oil'], ['roti']),
    ],
  },

  // --- Tamil Nadu sub-cuisines ---
  'tamil-nadu:chettinad': {
    breakfast: [
      V('Kuzhi Paniyaram', ['rice', 'urad dal', 'onion', 'carrot', 'curry leaves', 'oil'], ['quick']),
      V('Chettinad Masala Dosa', ['rice', 'urad dal', 'potato', 'onion', 'pepper', 'fennel', 'star anise'], ['popular']),
    ],
    lunch: [
      N('Chettinad Chicken Curry', ['chicken', 'onion', 'tomato', 'pepper', 'fennel', 'star anise', 'kalpasi', 'coconut'], ['curry']),
      N('Kozhi Varuval', ['chicken', 'shallot', 'curry leaves', 'pepper', 'fennel', 'red chilli', 'oil'], ['dry']),
      E('Chettinad Egg Roast', ['egg', 'shallot', 'tomato', 'pepper', 'fennel', 'curry leaves', 'oil'], ['curry']),
      V('Chettinad Kara Kuzhambu', ['tamarind', 'shallot', 'tomato', 'fennel', 'pepper', 'kalpasi', 'oil'], ['curry']),
      V('Kavuni Arisi', ['black rice', 'jaggery', 'coconut milk', 'ghee', 'cashew'], ['sweet']),
    ],
    dinner: [
      N('Chettinad Pepper Chicken', ['chicken', 'pepper', 'shallot', 'curry leaves', 'fennel', 'oil'], ['dry']),
      V('Chettinad Paniyaram with Chutney', ['rice', 'urad dal', 'coconut', 'red chilli', 'curry leaves'], ['tiffin']),
    ],
  },

  'tamil-nadu:kongunad': {
    breakfast: [
      V('Kollu Paruppu Dosai', ['rice', 'horse gram', 'cumin', 'pepper', 'oil']),
      V('Kambu Koozh', ['pearl millet', 'curd', 'salt', 'shallot', 'green chilli'], ['cooling']),
    ],
    lunch: [
      N('Kongunad Chicken Curry', ['chicken', 'coconut', 'onion', 'tomato', 'fennel', 'poppy seed', 'curry leaves'], ['curry']),
      V('Kollu Rasam', ['horse gram', 'tomato', 'tamarind', 'pepper', 'cumin', 'garlic', 'curry leaves'], ['soup']),
      V('Kongunad Ellu Kuzhambu', ['sesame', 'tamarind', 'coconut', 'shallot', 'red chilli', 'oil'], ['curry']),
    ],
    dinner: [
      V('Kongunad Ragi Mudde', ['ragi flour', 'water', 'salt'], ['millet']),
    ],
  },

  'tamil-nadu:madurai': {
    breakfast: [
      N('Kari Dosa', ['rice', 'urad dal', 'mutton keema', 'onion', 'curry leaves', 'oil']),
    ],
    lunch: [
      N('Madurai Seval Kuzhambu', ['chicken', 'onion', 'tomato', 'red chilli', 'fennel', 'curry leaves', 'oil'], ['curry']),
      N('Madurai Meen Kuzhambu', ['fish', 'tamarind', 'tomato', 'onion', 'chilli powder', 'curry leaves', 'oil'], ['curry']),
    ],
    dinner: [
      E('Muttai Parotta', ['wheat flour', 'egg', 'onion', 'green chilli', 'curry leaves', 'oil'], ['roti']),
      N('Madurai Bun Parotta with Salna', ['wheat flour', 'onion', 'tomato', 'chicken', 'fennel', 'coconut milk'], ['roti']),
    ],
  },

  'tamil-nadu:thanjavur': {
    breakfast: [
      V('Thanjavur Adai', ['rice', 'chana dal', 'urad dal', 'toor dal', 'red chilli', 'asafoetida', 'curry leaves']),
    ],
    lunch: [
      V('Thanjavur Special Sambar', ['toor dal', 'drumstick', 'eggplant', 'shallot', 'tamarind', 'sambar powder', 'coconut', 'oil'], ['curry']),
      V('Kootu Curry', ['raw banana', 'chana dal', 'coconut', 'cumin', 'mustard', 'curry leaves'], ['curry']),
      V('Paruppu Pradhaman', ['moong dal', 'jaggery', 'coconut milk', 'ghee', 'cardamom', 'cashew'], ['sweet']),
    ],
    dinner: [
      V('Thanjavur Mappillai Samba Rice', ['mappillai samba rice', 'toor dal', 'ghee', 'pepper', 'cumin'], ['rice']),
    ],
  },

  // =========================================================================
  // KERALA
  // =========================================================================
  'kerala': {
    breakfast: [
      V('Puttu with Kadala Curry', ['rice flour', 'coconut', 'black chickpea', 'onion', 'oil'], ['comfort']),
      V('Appam with Vegetable Stew', ['rice', 'coconut milk', 'yeast', 'potato', 'carrot', 'green pea', 'cardamom'], ['comfort']),
      E('Idiyappam with Egg Curry', ['rice flour', 'egg', 'onion', 'tomato', 'coconut milk', 'curry leaves'], ['comfort']),
      V('Dosa with Sambar', ['rice', 'urad dal', 'toor dal', 'drumstick', 'tamarind', 'sambar powder', 'oil']),
      V('Vellayappam', ['rice', 'coconut', 'sugar', 'yeast', 'oil']),
      E('Kerala Egg Roast', ['egg', 'onion', 'tomato', 'curry leaves', 'oil', 'chilli powder'], ['quick']),
      V('Idli with Coconut Chutney', ['rice', 'urad dal', 'coconut', 'green chilli', 'ginger', 'oil']),
      V('Wheat Puttu with Banana', ['wheat flour', 'coconut', 'banana', 'sugar']),
      V('Puttu with Pazhampori', ['rice flour', 'coconut', 'banana', 'sugar', 'oil']),
      V('Ada with Payasam', ['rice flour', 'jaggery', 'coconut milk', 'cardamom', 'ghee'], ['sweet']),
    ],
    lunch: [
      V('Kerala Sambar with Rice', ['rice', 'toor dal', 'drumstick', 'ash gourd', 'coconut', 'sambar powder', 'oil'], ['rice', 'comfort']),
      V('Avial', ['mixed vegetable', 'coconut', 'curd', 'curry leaves', 'oil', 'green chilli'], ['side']),
      V('Cabbage Thoran', ['cabbage', 'coconut', 'mustard', 'curry leaves', 'turmeric', 'oil'], ['side']),
      V('Erissery', ['pumpkin', 'black chickpea', 'coconut', 'turmeric', 'cumin', 'oil'], ['side']),
      V('Olan', ['ash gourd', 'black-eyed pea', 'coconut milk', 'curry leaves', 'oil'], ['side']),
      V('Parippu Curry', ['moong dal', 'coconut', 'turmeric', 'cumin', 'ghee', 'curry leaves'], ['dal']),
      V('Kerala Rasam', ['tomato', 'tamarind', 'pepper', 'cumin', 'garlic', 'curry leaves', 'oil'], ['soup']),
      V('Beans Thoran', ['french beans', 'coconut', 'mustard', 'curry leaves', 'turmeric', 'oil'], ['side']),
      N('Meen Moilee', ['fish', 'coconut milk', 'onion', 'ginger', 'green chilli', 'turmeric', 'oil'], ['curry']),
      N('Kerala Fish Curry', ['fish', 'coconut', 'kodampuli', 'shallot', 'ginger', 'curry leaves', 'chilli powder'], ['curry']),
      N('Kerala Chicken Curry', ['chicken', 'coconut milk', 'onion', 'tomato', 'ginger', 'curry leaves', 'oil'], ['curry']),
      E('Egg Roast with Rice', ['rice', 'egg', 'onion', 'tomato', 'curry leaves', 'oil', 'chilli powder'], ['rice']),
    ],
    dinner: [
      V('Appam with Stew', ['rice', 'coconut milk', 'potato', 'carrot', 'green pea', 'cardamom', 'clove'], ['comfort']),
      E('Kerala Parotta', ['maida', 'egg', 'oil', 'sugar', 'salt'], ['roti']),
      N('Chapati with Kerala Chicken Curry', ['wheat flour', 'chicken', 'coconut milk', 'onion', 'tomato', 'ginger'], ['roti']),
      V('Idiyappam with Coconut Milk', ['rice flour', 'coconut milk', 'sugar'], ['comfort']),
      N('Kerala Porotta with Beef Fry', ['wheat flour', 'beef', 'onion', 'curry leaves', 'oil', 'pepper', 'coconut'], ['roti']),
      V('Dosa with Coconut Chutney', ['rice', 'urad dal', 'coconut', 'green chilli', 'ginger', 'oil']),
      N('Pathiri with Chicken Curry', ['rice flour', 'chicken', 'coconut milk', 'onion', 'ginger', 'curry leaves'], ['roti']),
      E('Egg Curry with Appam', ['rice', 'coconut milk', 'egg', 'onion', 'tomato', 'curry leaves', 'oil']),
    ],
  },

  // --- Kerala sub-cuisines ---
  'kerala:malabar': {
    breakfast: [
      V('Pathiri', ['rice flour', 'water', 'salt', 'oil']),
      V('Unnakaya', ['ripe banana', 'cashew', 'raisin', 'sugar', 'rice flour', 'oil'], ['sweet']),
    ],
    lunch: [
      N('Malabar Biryani', ['basmati rice', 'chicken', 'onion', 'tomato', 'curd', 'ghee', 'biryani masala', 'mint'], ['rice']),
      N('Malabar Fish Curry', ['fish', 'coconut', 'kodampuli', 'shallot', 'red chilli', 'turmeric', 'oil'], ['curry']),
      N('Kallummakkaya Curry', ['mussel', 'coconut', 'onion', 'ginger', 'curry leaves', 'chilli powder', 'oil'], ['curry']),
      V('Malabar Kadala Curry', ['black chickpea', 'coconut', 'onion', 'tomato', 'curry leaves', 'oil'], ['curry']),
    ],
    dinner: [
      E('Malabar Parotta with Egg Curry', ['wheat flour', 'egg', 'onion', 'tomato', 'coconut milk', 'curry leaves']),
    ],
  },

  'kerala:travancore': {
    breakfast: [],
    lunch: [
      N('Kappa with Fish Curry', ['tapioca', 'fish', 'coconut', 'kodampuli', 'shallot', 'chilli powder', 'oil'], ['curry']),
      N('Karimeen Pollichathu', ['fish', 'oil', 'shallot', 'tomato', 'curry leaves', 'banana leaf'], ['curry']),
      N('Chemeen Theeyal', ['prawn', 'coconut', 'coriander seed', 'shallot', 'tamarind', 'curry leaves', 'oil'], ['curry']),
    ],
    dinner: [
      V('Travancore Avial with Rice', ['rice', 'drumstick', 'raw banana', 'yam', 'coconut', 'curd', 'oil'], ['rice']),
    ],
  },

  'kerala:central': {
    breakfast: [
      V('Pazham Pori', ['ripe banana', 'maida', 'sugar', 'turmeric', 'oil'], ['snack']),
    ],
    lunch: [
      N('Thalassery Biryani', ['basmati rice', 'chicken', 'onion', 'curd', 'ghee', 'biryani masala', 'cashew', 'raisin'], ['rice']),
      V('Kerala Sadhya Sambar', ['toor dal', 'drumstick', 'ash gourd', 'coconut', 'sambar powder', 'oil', 'shallot'], ['curry']),
      N('Erachi Ularthiyathu', ['beef', 'coconut', 'shallot', 'curry leaves', 'oil', 'pepper', 'coriander'], ['dry']),
    ],
    dinner: [
      V('Central Kerala Thoran with Rice', ['rice', 'french beans', 'coconut', 'mustard', 'curry leaves', 'oil'], ['rice']),
    ],
  },

  'kerala:palakkad': {
    breakfast: [
      V('Palakkad Kozhukattai', ['rice flour', 'coconut', 'jaggery', 'cardamom'], ['sweet']),
    ],
    lunch: [
      V('Palakkad Koottu Curry', ['raw banana', 'black chickpea', 'coconut', 'cumin', 'turmeric', 'oil'], ['curry']),
      V('Palakkad Elissery', ['pumpkin', 'red cow pea', 'coconut', 'turmeric', 'cumin', 'oil'], ['curry']),
      V('Vendakka Mappas', ['okra', 'coconut milk', 'onion', 'green chilli', 'turmeric', 'oil'], ['curry']),
      V('Palakkad Sambar', ['toor dal', 'drumstick', 'tamarind', 'sambar powder', 'ghee', 'curry leaves'], ['curry']),
    ],
    dinner: [],
  },

  // =========================================================================
  // KARNATAKA
  // =========================================================================
  'karnataka': {
    breakfast: [
      V('Rava Idli', ['rava', 'curd', 'cashew', 'mustard', 'curry leaves', 'carrot'], ['quick']),
      V('Bisi Bele Bath', ['rice', 'toor dal', 'mixed vegetable', 'bisi bele bath powder', 'tamarind', 'ghee'], ['one-pot']),
      V('Set Dosa', ['rice', 'urad dal', 'poha', 'sugar', 'oil']),
      V('Akki Rotti', ['rice flour', 'onion', 'carrot', 'coriander', 'green chilli', 'coconut'], ['millet']),
      V('Khara Bath', ['rava', 'onion', 'mixed vegetable', 'mustard', 'curry leaves', 'ghee'], ['quick']),
      V('Ragi Dosa', ['ragi flour', 'rice flour', 'onion', 'cumin', 'green chilli', 'oil'], ['millet']),
      V('Kesari Bath', ['rava', 'sugar', 'ghee', 'cashew', 'saffron', 'cardamom'], ['sweet']),
      E('Karnataka Egg Dosa', ['rice', 'urad dal', 'egg', 'onion', 'green chilli', 'oil']),
    ],
    lunch: [
      V('Vangi Bath', ['rice', 'eggplant', 'vangi bath powder', 'tamarind', 'peanut', 'coconut'], ['rice']),
      V('Chitranna', ['rice', 'lemon', 'turmeric', 'peanut', 'mustard', 'chana dal', 'curry leaves'], ['rice', 'quick']),
      V('Huli (Karnataka Sambar)', ['toor dal', 'mixed vegetable', 'tamarind', 'coconut', 'jaggery', 'mustard'], ['curry']),
      V('Saaru (Karnataka Rasam)', ['tomato', 'tamarind', 'pepper', 'cumin', 'curry leaves', 'coriander'], ['soup']),
      V('Gojju', ['raw mango', 'jaggery', 'coconut', 'tamarind', 'mustard', 'red chilli'], ['curry']),
      V('Palya (Beans)', ['french beans', 'coconut', 'mustard', 'urad dal', 'curry leaves', 'oil'], ['side']),
      V('Kosambari', ['moong dal', 'cucumber', 'coconut', 'lemon', 'mustard', 'coriander'], ['salad']),
      V('Majjige Huli', ['curd', 'coconut', 'ash gourd', 'mustard', 'curry leaves', 'green chilli'], ['curry', 'cooling']),
      N('Karnataka Mutton Curry', ['mutton', 'onion', 'coconut', 'coriander', 'red chilli', 'oil'], ['curry']),
      E('Karnataka Egg Curry', ['egg', 'onion', 'tomato', 'coconut', 'red chilli', 'curry leaves'], ['curry']),
    ],
    dinner: [
      V('Ragi Mudde with Saaru', ['ragi flour', 'water', 'tomato', 'tamarind', 'pepper', 'cumin'], ['millet']),
      V('Jolada Rotti with Ennegayi', ['jowar flour', 'eggplant', 'peanut', 'coconut', 'red chilli', 'oil'], ['millet']),
      V('Chapati with Palya', ['wheat flour', 'potato', 'coconut', 'mustard', 'curry leaves'], ['roti']),
      V('Set Dosa with Coconut Chutney', ['rice', 'urad dal', 'poha', 'coconut', 'green chilli']),
      V('Akki Rotti with Chutney Pudi', ['rice flour', 'onion', 'coconut', 'coriander', 'red chilli powder', 'oil'], ['millet']),
      V('Bisi Bele Bath (Dinner)', ['rice', 'toor dal', 'mixed vegetable', 'bisi bele bath powder', 'ghee'], ['one-pot']),
      N('Karnataka Chicken Saaru with Rice', ['rice', 'chicken', 'onion', 'tomato', 'pepper', 'curry leaves', 'coriander'], ['rice']),
      E('Egg Bhurji with Rotti', ['jowar flour', 'egg', 'onion', 'tomato', 'green chilli', 'coriander'], ['millet']),
    ],
  },

  // --- Karnataka sub-cuisines ---
  'karnataka:udupi-mangalore': {
    breakfast: [
      V('Neer Dosa', ['rice', 'coconut', 'salt', 'water']),
      V('Goli Baje', ['maida', 'curd', 'coconut', 'green chilli', 'ginger', 'oil'], ['snack']),
      V('Mangalore Buns', ['maida', 'banana', 'sugar', 'cumin', 'oil'], ['sweet']),
    ],
    lunch: [
      N('Kori Rotti', ['rice wafer', 'chicken', 'coconut', 'onion', 'tamarind', 'red chilli'], ['curry']),
      V('Gassi', ['mixed vegetable', 'coconut', 'coriander seed', 'tamarind', 'red chilli', 'oil'], ['curry']),
      V('Mangalore Sambar', ['toor dal', 'cucumber', 'coconut', 'tamarind', 'mustard', 'oil'], ['curry']),
    ],
    dinner: [
      V('Neer Dosa with Coconut Chutney', ['rice', 'coconut', 'green chilli', 'ginger', 'oil']),
    ],
  },

  'karnataka:north': {
    breakfast: [
      V('Jolada Rotti', ['jowar flour', 'water', 'salt'], ['millet']),
    ],
    lunch: [
      V('Ennegayi', ['eggplant', 'peanut', 'coconut', 'sesame', 'red chilli', 'jaggery', 'oil'], ['curry']),
      V('Bele Holige', ['chana dal', 'wheat flour', 'jaggery', 'cardamom', 'ghee'], ['sweet']),
      V('North Karnataka Soppina Saaru', ['spinach', 'toor dal', 'tamarind', 'garlic', 'red chilli', 'mustard'], ['curry']),
    ],
    dinner: [
      V('Jolada Rotti with Shenga Chutney', ['jowar flour', 'peanut', 'garlic', 'red chilli', 'tamarind'], ['millet']),
    ],
  },

  'karnataka:malnad': {
    breakfast: [
      V('Malnad Akki Rotti', ['rice flour', 'onion', 'carrot', 'green chilli', 'coconut', 'coriander'], ['millet']),
    ],
    lunch: [
      V('Kadabu', ['rice', 'jaggery', 'coconut', 'cardamom'], ['sweet']),
      V('Bamboo Shoot Curry', ['bamboo shoot', 'coconut', 'mustard', 'curry leaves', 'turmeric', 'red chilli'], ['curry']),
    ],
    dinner: [
      N('Malnad Pork Curry', ['pork', 'kachampuli', 'onion', 'pepper', 'coriander', 'coconut'], ['curry']),
    ],
  },

  'karnataka:kodava': {
    breakfast: [],
    lunch: [
      N('Pandi Curry', ['pork', 'kachampuli', 'garlic', 'pepper', 'coriander', 'cumin'], ['curry']),
      V('Kadambuttu', ['rice flour', 'water', 'salt']),
      V('Nool Puttu', ['rice flour', 'water', 'salt', 'coconut milk']),
      N('Kummu Curry', ['mushroom', 'chicken', 'pepper', 'coriander', 'kachampuli', 'coconut'], ['curry']),
    ],
    dinner: [
      V('Kadambuttu with Vegetable Curry', ['rice flour', 'mixed vegetable', 'coconut', 'pepper', 'coriander'], ['curry']),
      N('Kodava Chicken Curry with Nool Puttu', ['rice flour', 'chicken', 'coconut', 'pepper', 'kachampuli', 'coriander'], ['curry']),
    ],
  },

  // =========================================================================
  // ANDHRA
  // =========================================================================
  'andhra': {
    breakfast: [
      V('Pesarattu', ['green moong dal', 'green chilli', 'ginger', 'cumin', 'onion', 'oil']),
      V('Upma with Allam Pachadi', ['rava', 'onion', 'mustard', 'ginger', 'green chilli', 'lemon'], ['quick']),
      V('Andhra Idli with Peanut Chutney', ['rice', 'urad dal', 'peanut', 'red chilli', 'garlic', 'tamarind']),
      V('Minapa Rotte', ['urad dal', 'rice flour', 'cumin', 'onion', 'green chilli']),
      V('Andhra Pongal', ['rice', 'moong dal', 'pepper', 'cumin', 'ghee', 'ginger'], ['comfort']),
      V('Rava Dosa with Coconut Chutney', ['rava', 'rice flour', 'onion', 'green chilli', 'cumin', 'coconut'], ['quick']),
      E('Andhra Egg Dosa', ['rice', 'urad dal', 'egg', 'onion', 'green chilli', 'oil']),
      V('Attu (Pesarattu with Upma)', ['green moong dal', 'rava', 'onion', 'ginger', 'green chilli', 'oil']),
    ],
    lunch: [
      V('Gongura Pachadi with Rice', ['rice', 'gongura leaf', 'red chilli', 'mustard', 'garlic', 'oil'], ['rice']),
      V('Gutti Vankaya Kura', ['eggplant', 'peanut', 'sesame', 'coconut', 'tamarind', 'red chilli'], ['curry']),
      V('Pappu with Rice', ['rice', 'toor dal', 'tomato', 'turmeric', 'mustard', 'cumin', 'ghee'], ['rice', 'comfort']),
      V('Pulihora', ['rice', 'tamarind', 'peanut', 'turmeric', 'mustard', 'curry leaves', 'chana dal'], ['rice']),
      V('Pappu Charu', ['toor dal', 'tomato', 'tamarind', 'pepper', 'cumin', 'garlic', 'curry leaves'], ['soup']),
      V('Bendakaya Pulusu', ['okra', 'tamarind', 'onion', 'red chilli', 'mustard', 'curry leaves', 'oil'], ['curry']),
      V('Dondakaya Fry', ['ivy gourd', 'onion', 'red chilli', 'mustard', 'turmeric', 'oil'], ['side']),
      N('Andhra Chicken Curry', ['chicken', 'onion', 'tomato', 'red chilli', 'curry leaves', 'coriander', 'oil'], ['curry']),
      N('Chepala Pulusu', ['fish', 'tamarind', 'onion', 'tomato', 'red chilli', 'fenugreek', 'curry leaves'], ['curry']),
      E('Andhra Egg Pulusu', ['egg', 'tamarind', 'onion', 'tomato', 'red chilli', 'curry leaves', 'mustard'], ['curry']),
    ],
    dinner: [
      V('Pesarattu with Ginger Chutney', ['green moong dal', 'ginger', 'green chilli', 'onion', 'oil']),
      V('Roti with Andhra Dal', ['wheat flour', 'toor dal', 'tomato', 'tamarind', 'red chilli', 'mustard'], ['roti']),
      V('Andhra Tomato Rice', ['rice', 'tomato', 'peanut', 'red chilli', 'mustard', 'curry leaves'], ['rice']),
      V('Dosa with Andhra Peanut Chutney', ['rice', 'urad dal', 'peanut', 'red chilli', 'garlic', 'tamarind']),
      E('Andhra Egg Fried Rice', ['rice', 'egg', 'onion', 'green chilli', 'soy sauce', 'oil'], ['rice']),
      N('Andhra Chicken Biryani', ['basmati rice', 'chicken', 'onion', 'curd', 'mint', 'ghee', 'biryani masala'], ['rice']),
    ],
  },

  // =========================================================================
  // TELANGANA
  // =========================================================================
  'telangana': {
    breakfast: [
      V('Sakinalu', ['rice flour', 'sesame', 'cumin', 'oil'], ['snack']),
      V('Sarva Pindi', ['rice flour', 'chana dal', 'peanut', 'sesame', 'red chilli', 'curry leaves']),
      V('Jonna Rotte', ['jowar flour', 'water', 'salt'], ['millet']),
      V('Telangana Pesarattu', ['green moong dal', 'rice', 'ginger', 'green chilli', 'oil']),
      V('Telangana Upma', ['broken wheat', 'onion', 'mustard', 'green chilli', 'curry leaves', 'oil'], ['quick']),
      E('Telangana Egg Dosa', ['rice', 'urad dal', 'egg', 'onion', 'green chilli', 'oil']),
    ],
    lunch: [
      V('Mudda Pappu with Rice', ['rice', 'toor dal', 'green chilli', 'ghee', 'cumin'], ['rice', 'comfort']),
      V('Telangana Tomato Pappu', ['toor dal', 'tomato', 'turmeric', 'mustard', 'red chilli', 'curry leaves'], ['dal']),
      V('Bachali Kura', ['malabar spinach', 'garlic', 'red chilli', 'mustard', 'turmeric'], ['side']),
      V('Pachi Pulusu', ['tamarind', 'onion', 'green chilli', 'mustard', 'cumin', 'coriander'], ['curry']),
      V('Telangana Pappu Charu', ['toor dal', 'tomato', 'tamarind', 'pepper', 'cumin', 'curry leaves'], ['soup']),
      N('Golichina Mamsam', ['mutton', 'onion', 'ginger', 'garlic', 'red chilli', 'coriander', 'oil'], ['curry']),
      N('Telangana Chicken Fry', ['chicken', 'onion', 'curry leaves', 'red chilli', 'ginger', 'garlic', 'oil'], ['dry']),
      E('Telangana Egg Curry', ['egg', 'onion', 'tomato', 'red chilli', 'turmeric', 'curry leaves'], ['curry']),
    ],
    dinner: [
      V('Jonna Rotte with Brinjal Curry', ['jowar flour', 'eggplant', 'peanut', 'sesame', 'red chilli'], ['millet']),
      V('Roti with Mudda Pappu', ['wheat flour', 'toor dal', 'green chilli', 'ghee'], ['roti']),
      V('Dosa with Peanut Chutney', ['rice', 'urad dal', 'peanut', 'red chilli', 'garlic']),
      N('Telangana Biryani', ['basmati rice', 'mutton', 'onion', 'curd', 'ghee', 'biryani masala', 'mint'], ['rice']),
      E('Telangana Egg Biryani', ['basmati rice', 'egg', 'onion', 'curd', 'ghee', 'biryani masala'], ['rice']),
      N('Telangana Keema with Roti', ['wheat flour', 'mutton keema', 'onion', 'ginger', 'garlic', 'red chilli', 'coriander'], ['roti']),
    ],
  },

  // --- Telangana sub-cuisine ---
  'telangana:hyderabadi': {
    breakfast: [
      V('Hyderabadi Dahi Vada', ['urad dal', 'curd', 'tamarind', 'mint', 'cumin', 'red chilli'], ['snack']),
    ],
    lunch: [
      N('Hyderabadi Biryani', ['basmati rice', 'chicken', 'curd', 'onion', 'ghee', 'saffron', 'biryani masala', 'mint'], ['rice']),
      V('Mirchi ka Salan', ['green chilli', 'peanut', 'sesame', 'coconut', 'tamarind', 'onion', 'oil'], ['curry']),
      V('Bagara Baingan', ['eggplant', 'peanut', 'sesame', 'coconut', 'tamarind', 'onion', 'red chilli'], ['curry']),
      N('Haleem', ['wheat', 'mutton', 'ghee', 'onion', 'ginger', 'garlic', 'garam masala', 'lemon'], ['one-pot']),
    ],
    dinner: [
      V('Double ka Meetha', ['bread', 'milk', 'sugar', 'saffron', 'cardamom', 'ghee', 'dry fruit'], ['sweet']),
      E('Hyderabadi Egg Biryani', ['basmati rice', 'egg', 'onion', 'curd', 'ghee', 'saffron', 'biryani masala'], ['rice']),
    ],
  },

  // =========================================================================
  // GOAN
  // =========================================================================
  'goan': {
    breakfast: [
      V('Poee with Chutney', ['wheat flour', 'toddy', 'jaggery', 'coconut', 'green chilli']),
      V('Goan Pao with Bhaji', ['pao bread', 'potato', 'onion', 'turmeric', 'green chilli']),
      E('Goan Egg Fry', ['egg', 'onion', 'green chilli', 'turmeric', 'oil'], ['quick']),
      V('Sanna', ['rice', 'coconut', 'toddy', 'sugar']),
      V('Goan Banana Fritters', ['banana', 'wheat flour', 'sugar', 'cardamom', 'oil'], ['sweet']),
    ],
    lunch: [
      N('Goan Fish Curry Rice', ['fish', 'coconut', 'tamarind', 'red chilli', 'turmeric', 'rice'], ['rice', 'curry']),
      N('Vindaloo', ['pork', 'vinegar', 'garlic', 'red chilli', 'cumin', 'cinnamon'], ['curry']),
      N('Xacuti', ['chicken', 'coconut', 'poppy seed', 'star anise', 'cinnamon', 'red chilli'], ['curry']),
      V('Goan Dalitoy', ['toor dal', 'coconut', 'kokum', 'turmeric', 'cumin', 'garlic'], ['dal']),
      V('Vegetable Caldeen', ['mixed vegetable', 'coconut milk', 'green chilli', 'turmeric', 'coriander', 'tamarind'], ['curry']),
      N('Goan Prawn Balchao', ['prawn', 'vinegar', 'onion', 'tomato', 'red chilli', 'sugar'], ['curry']),
      V('Solkadi', ['kokum', 'coconut milk', 'garlic', 'cumin', 'coriander', 'green chilli'], ['drink']),
      V('Vegetable Xacuti', ['mushroom', 'coconut', 'poppy seed', 'cinnamon', 'red chilli', 'onion'], ['curry']),
    ],
    dinner: [
      N('Pao with Goan Chicken Cafreal', ['pao bread', 'chicken', 'coriander', 'green chilli', 'ginger', 'lime'], ['roti']),
      V('Sanna with Goan Veg Curry', ['rice', 'coconut', 'toddy', 'coconut milk', 'mixed vegetable']),
      N('Goan Prawn Pulao', ['rice', 'prawn', 'onion', 'tomato', 'coconut milk', 'coriander'], ['rice']),
      E('Goan Egg Curry', ['egg', 'coconut', 'tamarind', 'red chilli', 'onion', 'turmeric'], ['curry']),
      E('Bebinca', ['coconut milk', 'sugar', 'egg yolk', 'maida', 'ghee', 'cardamom', 'nutmeg'], ['sweet']),
    ],
  },

  // =========================================================================
  // PUNJABI
  // =========================================================================
  'punjabi': {
    breakfast: [
      V('Aloo Paratha', ['wheat flour', 'potato', 'green chilli', 'coriander', 'ghee', 'curd'], ['comfort']),
      V('Gobi Paratha', ['wheat flour', 'cauliflower', 'green chilli', 'coriander', 'ghee']),
      V('Mooli Paratha', ['wheat flour', 'radish', 'green chilli', 'coriander', 'ghee']),
      V('Chole Bhature', ['chickpea', 'maida', 'onion', 'tomato', 'chole masala', 'oil'], ['popular']),
      V('Paneer Paratha', ['wheat flour', 'paneer', 'green chilli', 'coriander', 'cumin', 'ghee']),
      E('Punjabi Omelette with Paratha', ['egg', 'onion', 'green chilli', 'wheat flour', 'ghee']),
      V('Besan Chilla', ['besan', 'onion', 'tomato', 'green chilli', 'coriander', 'oil'], ['quick']),
    ],
    lunch: [
      V('Rajma Chawal', ['rajma', 'rice', 'onion', 'tomato', 'ginger', 'garam masala'], ['rice', 'comfort']),
      V('Dal Makhani', ['urad dal', 'rajma', 'butter', 'cream', 'onion', 'tomato', 'garam masala'], ['dal', 'rich']),
      V('Chole with Rice', ['chickpea', 'rice', 'onion', 'tomato', 'chole masala', 'coriander'], ['rice']),
      V('Sarson ka Saag with Makki Roti', ['mustard green', 'spinach', 'maize flour', 'ghee', 'onion', 'ginger'], ['seasonal']),
      V('Paneer Butter Masala', ['paneer', 'butter', 'cream', 'tomato', 'cashew', 'garam masala', 'kasuri methi'], ['rich']),
      V('Aloo Gobi', ['potato', 'cauliflower', 'onion', 'tomato', 'turmeric', 'cumin', 'coriander'], ['side']),
      V('Kadhi Pakora', ['curd', 'besan', 'onion', 'mustard', 'turmeric', 'fenugreek', 'cumin'], ['curry']),
      V('Baingan Bharta', ['eggplant', 'onion', 'tomato', 'green chilli', 'oil', 'coriander'], ['side']),
      N('Butter Chicken', ['chicken', 'butter', 'cream', 'tomato', 'cashew', 'garam masala', 'kasuri methi'], ['rich']),
      E('Punjabi Egg Curry', ['egg', 'onion', 'tomato', 'garam masala', 'ginger', 'garlic', 'coriander'], ['curry']),
    ],
    dinner: [
      V('Roti with Paneer Bhurji', ['wheat flour', 'paneer', 'onion', 'tomato', 'green chilli', 'coriander'], ['roti']),
      V('Aloo Gobi with Roti', ['wheat flour', 'potato', 'cauliflower', 'turmeric', 'cumin', 'coriander'], ['roti']),
      V('Dal Fry with Rice', ['toor dal', 'rice', 'onion', 'tomato', 'garlic', 'cumin', 'ghee'], ['rice']),
      V('Roti with Palak Paneer', ['wheat flour', 'paneer', 'spinach', 'onion', 'garlic', 'cream', 'green chilli'], ['roti']),
      V('Laccha Paratha with Mixed Veg', ['wheat flour', 'ghee', 'mixed vegetable', 'onion', 'tomato', 'garam masala'], ['roti']),
      V('Roti with Baingan Bharta', ['wheat flour', 'eggplant', 'onion', 'tomato', 'green chilli', 'oil'], ['roti']),
      N('Chicken Roti', ['wheat flour', 'chicken', 'onion', 'tomato', 'garam masala', 'coriander'], ['roti']),
      E('Punjabi Egg Bhurji with Roti', ['wheat flour', 'egg', 'onion', 'tomato', 'green chilli', 'coriander'], ['roti']),
    ],
  },

  // =========================================================================
  // BENGALI
  // =========================================================================
  'bengali': {
    breakfast: [
      V('Luchi with Aloor Dom', ['maida', 'potato', 'ghee', 'cumin', 'bay leaf', 'ginger'], ['comfort']),
      V('Radhaballabhi', ['maida', 'urad dal', 'ginger', 'cumin', 'asafoetida', 'oil']),
      V('Koraishutir Kochuri', ['maida', 'green pea', 'ginger', 'cumin', 'oil'], ['seasonal']),
      E('Bengali Egg Roll', ['maida', 'egg', 'onion', 'green chilli', 'lemon', 'oil']),
      V('Panta Bhat', ['rice', 'water', 'salt', 'onion', 'green chilli'], ['summer']),
      V('Moong Dal Khichuri', ['rice', 'moong dal', 'potato', 'ghee', 'cumin', 'bay leaf', 'turmeric'], ['comfort']),
    ],
    lunch: [
      V('Shukto', ['bitter gourd', 'potato', 'drumstick', 'milk', 'mustard paste', 'panch phoron'], ['traditional']),
      V('Cholar Dal', ['chana dal', 'coconut', 'ghee', 'bay leaf', 'cumin', 'raisin'], ['dal']),
      V('Aloo Posto', ['potato', 'poppy seed', 'green chilli', 'oil', 'turmeric'], ['side']),
      V('Begun Bhaja', ['eggplant', 'turmeric', 'salt', 'oil'], ['side']),
      V('Mochar Ghonto', ['banana flower', 'potato', 'coconut', 'cumin', 'bay leaf', 'ghee'], ['side']),
      V('Labra', ['mixed vegetable', 'panch phoron', 'oil', 'turmeric', 'green chilli'], ['side']),
      N('Machher Jhol', ['fish', 'potato', 'turmeric', 'cumin', 'oil', 'green chilli'], ['curry']),
      N('Kosha Mangsho', ['mutton', 'onion', 'ginger', 'garlic', 'garam masala', 'oil', 'curd'], ['curry']),
      N('Doi Machh', ['fish', 'curd', 'turmeric', 'cumin', 'oil', 'green chilli'], ['curry']),
      E('Dimer Dalna', ['egg', 'potato', 'onion', 'tomato', 'turmeric', 'cumin', 'oil'], ['curry']),
    ],
    dinner: [
      V('Roti with Cholar Dal', ['wheat flour', 'chana dal', 'coconut', 'ghee', 'cumin'], ['roti']),
      V('Bengali Khichuri', ['rice', 'moong dal', 'potato', 'cauliflower', 'ghee', 'cumin', 'bay leaf'], ['one-pot', 'comfort']),
      V('Bengali Moong Dal with Rice', ['moong dal', 'rice', 'ghee', 'cumin', 'bay leaf'], ['rice']),
      N('Fish Fry with Rice', ['fish', 'rice', 'mustard paste', 'turmeric', 'salt', 'oil'], ['rice']),
      E('Phulko Luchi with Egg Curry', ['maida', 'egg', 'onion', 'tomato', 'garam masala', 'oil']),
      N('Mangshor Jhol with Rice', ['rice', 'mutton', 'potato', 'onion', 'ginger', 'garlic', 'garam masala', 'oil'], ['rice']),
    ],
  },

  // =========================================================================
  // MARATHI
  // =========================================================================
  'marathi': {
    breakfast: [
      V('Kanda Poha', ['poha', 'onion', 'potato', 'peanut', 'turmeric', 'mustard', 'curry leaves'], ['quick']),
      V('Thalipeeth', ['bhajani flour', 'onion', 'coriander', 'cumin', 'oil']),
      V('Sabudana Khichdi', ['sabudana', 'potato', 'peanut', 'cumin', 'green chilli', 'coriander'], ['fasting']),
      V('Misal Pav', ['moth bean sprout', 'pav', 'onion', 'farsan', 'red chilli', 'garlic'], ['popular']),
      V('Kanda Bhaji', ['onion', 'besan', 'rice flour', 'red chilli', 'oil'], ['snack']),
      E('Marathi Egg Bhurji with Pav', ['egg', 'onion', 'tomato', 'green chilli', 'pav', 'oil'], ['quick']),
    ],
    lunch: [
      V('Varan Bhaat', ['toor dal', 'rice', 'ghee', 'turmeric', 'salt'], ['rice', 'comfort']),
      V('Pithla Bhakri', ['besan', 'jowar flour', 'onion', 'garlic', 'turmeric', 'oil'], ['millet']),
      V('Usal', ['sprouted moth', 'onion', 'tomato', 'goda masala', 'coconut', 'coriander'], ['curry']),
      V('Bharli Vangi', ['eggplant', 'peanut', 'coconut', 'goda masala', 'tamarind', 'jaggery'], ['curry']),
      V('Zunka Bhakri', ['besan', 'jowar flour', 'onion', 'garlic', 'green chilli', 'turmeric'], ['millet']),
      V('Batata Bhaji with Chapati', ['potato', 'onion', 'wheat flour', 'mustard', 'turmeric', 'curry leaves', 'oil'], ['roti']),
      N('Kombdi Vade', ['chicken', 'rice flour', 'coconut', 'onion', 'red chilli', 'oil'], ['curry']),
      E('Marathi Egg Curry', ['egg', 'onion', 'tomato', 'green chilli', 'turmeric', 'goda masala', 'oil'], ['curry']),
    ],
    dinner: [
      V('Chapati with Batata Bhaji', ['wheat flour', 'potato', 'onion', 'mustard', 'turmeric', 'oil'], ['roti']),
      V('Bhakri with Thecha', ['jowar flour', 'green chilli', 'garlic', 'peanut', 'coriander'], ['millet']),
      V('Puran Poli', ['wheat flour', 'chana dal', 'jaggery', 'cardamom', 'ghee'], ['sweet']),
      V('Amti with Rice', ['toor dal', 'rice', 'kokum', 'jaggery', 'goda masala', 'coconut', 'ghee'], ['rice']),
      N('Roti with Kolhapuri Chicken', ['wheat flour', 'chicken', 'onion', 'coconut', 'red chilli', 'kolhapuri masala'], ['roti']),
      E('Marathi Egg Curry with Rice', ['rice', 'egg', 'onion', 'tomato', 'goda masala', 'coconut'], ['rice']),
    ],
  },

  // =========================================================================
  // GUJARATI
  // =========================================================================
  'gujarati': {
    breakfast: [
      V('Dhokla', ['besan', 'curd', 'mustard', 'green chilli', 'sugar', 'oil'], ['steamed']),
      V('Thepla', ['wheat flour', 'fenugreek leaf', 'curd', 'turmeric', 'oil']),
      V('Khandvi', ['besan', 'curd', 'turmeric', 'mustard', 'sesame', 'coconut', 'curry leaves']),
      V('Handvo', ['rice', 'chana dal', 'toor dal', 'bottle gourd', 'sesame', 'mustard']),
      V('Khaman', ['besan', 'citric acid', 'sugar', 'mustard', 'curry leaves', 'green chilli'], ['steamed']),
      V('Fafda with Jalebi', ['besan', 'turmeric', 'carom seed', 'oil', 'maida', 'sugar', 'saffron'], ['popular']),
    ],
    lunch: [
      V('Dal Dhokli', ['toor dal', 'wheat flour', 'peanut', 'jaggery', 'tamarind', 'turmeric'], ['one-pot']),
      V('Undhiyu', ['surti papdi', 'purple yam', 'potato', 'eggplant', 'methi muthia', 'coconut', 'jaggery'], ['seasonal']),
      V('Gujarati Kadhi', ['curd', 'besan', 'sugar', 'ginger', 'mustard', 'curry leaves'], ['curry']),
      V('Sev Tameta nu Shaak', ['tomato', 'sev', 'peanut', 'jaggery', 'mustard', 'curry leaves'], ['curry']),
      V('Ringan nu Olo', ['eggplant', 'peanut', 'jaggery', 'tamarind', 'sesame', 'red chilli'], ['curry']),
      V('Gujarati Dal with Rice', ['toor dal', 'rice', 'peanut', 'jaggery', 'lemon', 'mustard', 'curry leaves'], ['rice', 'comfort']),
      V('Methi Thepla with Shaak', ['wheat flour', 'fenugreek leaf', 'curd', 'potato', 'onion', 'turmeric'], ['roti']),
      V('Bhinda nu Shaak', ['okra', 'peanut', 'jaggery', 'lemon', 'mustard', 'turmeric', 'oil'], ['side']),
      V('Valor Papdi nu Shaak', ['flat beans', 'coconut', 'mustard', 'jaggery', 'curry leaves', 'oil'], ['side']),
      V('Khichdi with Kadhi', ['rice', 'moong dal', 'curd', 'besan', 'ghee', 'cumin', 'mustard'], ['one-pot', 'comfort']),
    ],
    dinner: [
      V('Rotla with Ringan Bharta', ['bajra flour', 'eggplant', 'onion', 'garlic', 'oil', 'coriander'], ['millet']),
      V('Puri with Shaak', ['wheat flour', 'potato', 'onion', 'turmeric', 'mustard', 'oil']),
      V('Khichdi Kadhi', ['rice', 'moong dal', 'curd', 'besan', 'ghee', 'cumin', 'mustard'], ['one-pot']),
      V('Thepla with Curd', ['wheat flour', 'fenugreek leaf', 'curd', 'turmeric', 'oil']),
      V('Muthia', ['wheat flour', 'bottle gourd', 'fenugreek leaf', 'sesame', 'mustard', 'oil'], ['steamed']),
      V('Bajra Rotla with Garlic Chutney', ['bajra flour', 'garlic', 'red chilli', 'peanut', 'oil'], ['millet']),
    ],
  },

  // =========================================================================
  // RAJASTHANI
  // =========================================================================
  'rajasthani': {
    breakfast: [
      V('Pyaaz Kachori', ['maida', 'onion', 'fennel', 'red chilli', 'coriander', 'oil']),
      V('Bajra Roti with Lehsun Chutney', ['bajra flour', 'garlic', 'red chilli', 'ghee'], ['millet']),
      V('Mawa Kachori', ['maida', 'khoya', 'dry fruit', 'sugar', 'cardamom', 'oil'], ['sweet']),
      V('Dal Baati', ['wheat flour', 'moong dal', 'chana dal', 'ghee', 'cumin', 'red chilli'], ['comfort']),
      V('Mirchi Vada', ['green chilli', 'potato', 'besan', 'coriander', 'oil'], ['snack']),
    ],
    lunch: [
      V('Dal Baati Churma', ['wheat flour', 'moong dal', 'chana dal', 'ghee', 'jaggery', 'cumin'], ['comfort']),
      V('Gatte ki Sabzi', ['besan', 'curd', 'cumin', 'red chilli', 'turmeric', 'oil'], ['curry']),
      V('Ker Sangri', ['ker berry', 'sangri bean', 'red chilli', 'oil', 'cumin', 'amchur'], ['side']),
      V('Papad ki Sabzi', ['papad', 'curd', 'cumin', 'red chilli', 'turmeric', 'coriander'], ['curry']),
      V('Bajre ki Roti with Lahsun Chutney', ['bajra flour', 'garlic', 'red chilli', 'ghee', 'curd'], ['millet']),
      V('Churma', ['wheat flour', 'ghee', 'jaggery', 'cardamom', 'dry fruit'], ['sweet']),
      N('Laal Maas', ['mutton', 'curd', 'garlic', 'red chilli', 'oil', 'onion'], ['curry']),
      E('Rajasthani Egg Curry', ['egg', 'onion', 'tomato', 'curd', 'red chilli', 'turmeric'], ['curry']),
    ],
    dinner: [
      V('Bajra Roti with Gatte ki Sabzi', ['bajra flour', 'besan', 'curd', 'cumin', 'red chilli', 'ghee'], ['millet']),
      V('Roti with Rajasthani Kadhi', ['wheat flour', 'besan', 'curd', 'cumin', 'mustard', 'red chilli'], ['roti']),
      V('Rajasthani Khichdi', ['rice', 'moong dal', 'ghee', 'cumin', 'turmeric', 'green chilli'], ['one-pot']),
      V('Roti with Ker Sangri', ['wheat flour', 'ker berry', 'sangri bean', 'red chilli', 'oil'], ['roti']),
      N('Safed Maas', ['mutton', 'curd', 'cream', 'cashew', 'cardamom', 'ghee'], ['rich']),
    ],
  },

  // =========================================================================
  // KASHMIRI
  // =========================================================================
  'kashmiri': {
    breakfast: [
      V('Sheermal', ['maida', 'milk', 'ghee', 'saffron', 'sugar', 'cardamom']),
      V('Kashmiri Kulcha', ['maida', 'milk', 'sugar', 'ghee', 'sesame', 'poppy seed']),
      V('Kashmiri Noon Chai with Girda', ['green tea', 'milk', 'baking soda', 'salt', 'wheat flour']),
      V('Tchot', ['wheat flour', 'ghee', 'salt']),
      E('Kashmiri Omelette', ['egg', 'onion', 'tomato', 'green chilli', 'kashmiri chilli', 'oil']),
    ],
    lunch: [
      N('Rogan Josh', ['mutton', 'curd', 'kashmiri chilli', 'fennel', 'ginger powder', 'oil'], ['curry']),
      V('Kashmiri Dum Aloo', ['potato', 'curd', 'kashmiri chilli', 'fennel', 'ginger powder', 'oil'], ['curry']),
      V('Rajma Gogji', ['rajma', 'turnip', 'ginger powder', 'fennel', 'asafoetida', 'oil'], ['curry']),
      V('Nadru Yakhni', ['lotus stem', 'curd', 'fennel', 'cardamom', 'bay leaf', 'oil'], ['curry']),
      V('Haak Saag', ['collard green', 'oil', 'red chilli', 'asafoetida', 'water'], ['side']),
      N('Yakhni', ['mutton', 'curd', 'fennel', 'cardamom', 'bay leaf', 'ginger powder', 'oil'], ['curry']),
      N('Gushtaba', ['mutton', 'curd', 'fennel', 'cardamom', 'ginger powder', 'oil', 'clove'], ['curry']),
      N('Kashmiri Fried Fish', ['fish', 'besan', 'kashmiri chilli', 'ginger', 'oil'], ['dry']),
    ],
    dinner: [
      V('Rice with Dum Aloo', ['rice', 'potato', 'curd', 'kashmiri chilli', 'fennel', 'oil'], ['rice']),
      V('Kashmiri Pulao', ['basmati rice', 'dry fruit', 'saffron', 'ghee', 'cardamom', 'cinnamon'], ['rice']),
      N('Rice with Rogan Josh', ['basmati rice', 'mutton', 'curd', 'kashmiri chilli', 'fennel', 'oil'], ['rice']),
      V('Roti with Haak Saag', ['wheat flour', 'collard green', 'oil', 'red chilli', 'asafoetida'], ['roti']),
      E('Kashmiri Egg Curry with Rice', ['rice', 'egg', 'curd', 'kashmiri chilli', 'fennel', 'ginger powder'], ['rice']),
    ],
  },
};

// ---------------------------------------------------------------------------
// Seeding function
// ---------------------------------------------------------------------------
export async function seedCuisine(store, cuisineKey, diet) {
  const catalog = SEEDS[cuisineKey];
  if (!catalog) return 0;

  const allowedDiets = new Set(DIET_ALLOWED[diet] || DIET_ALLOWED.all);
  const existingItems = await store.allItems();

  // Check if already seeded at this diet tier
  const metaKey = `seeded:${cuisineKey}:${diet}`;
  const alreadySeeded = existingItems.some(
    (item) => item.type === 'meta' && item.id === metaKey
  );
  if (alreadySeeded) return 0;

  const existingIds = new Set(existingItems.map((i) => i.id));
  let count = 0;

  for (const mealType of ['breakfast', 'lunch', 'dinner']) {
    const dishes = catalog[mealType] || [];
    for (let n = 0; n < dishes.length; n++) {
      const dish = dishes[n];
      if (!allowedDiets.has(dish.diet)) continue;
      const id = `seed-${cuisineKey}-${mealType}-${n}`;
      if (existingIds.has(id)) continue;
      await store.putItem({
        id,
        type: 'dish',
        name: dish.name,
        meal: mealType,
        cuisine: dish.cuisine || cuisineKey,
        diet: dish.diet,
        ingredients: dish.ingredients || [],
        tags: dish.tags || [],
        ref: dish.ref || '',
        notes: dish.notes || '',
        deleted: false,
        deleted_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        dirty: 1,
      });
      count++;
    }
  }

  // Add a meta marker so re-seeding is idempotent
  if (count > 0) {
    await store.putItem({
      id: metaKey,
      type: 'meta',
      key: metaKey,
      value: true,
      deleted: false,
      deleted_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      dirty: 1,
    });
  }

  return count;
}

// ---------------------------------------------------------------------------
// Backup: export / import
// ---------------------------------------------------------------------------
export async function exportAll(store) {
  const items = await store.allItems();
  return JSON.stringify({ version: 1, exported_at: Date.now(), items }, null, 2);
}

export async function importAll(store, json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data.items || !Array.isArray(data.items)) throw new Error('invalid backup format');
  for (const item of data.items) {
    await store.putItem({ ...item, dirty: 1 });
  }
  return { count: data.items.length };
}

// ---------------------------------------------------------------------------
// newItem helper (Aduppu data model defaults)
// ---------------------------------------------------------------------------
export function newItem(partial) {
  return {
    id: crypto.randomUUID(),
    type: 'dish',
    deleted: false,
    deleted_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    dirty: 0,
    ...partial,
  };
}
