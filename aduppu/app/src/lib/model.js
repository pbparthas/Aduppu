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
// ---------------------------------------------------------------------------
export const SEEDS = {
  // =========================================================================
  // TAMIL NADU (ported from v1 DEFAULTS verbatim — all veg)
  // =========================================================================
  'tamil-nadu': {
    breakfast: [
      { name: 'Idli', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'urad dal', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Dosa', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'urad dal', 'oil', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Pongal', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'moong dal', 'ghee', 'pepper', 'cumin', 'ginger'], tags: [], ref: '', notes: '' },
      { name: 'Upma', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rava', 'onion', 'green chilli', 'mustard', 'curry leaves', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Idiyappam', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice flour', 'salt', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Poori', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['wheat flour', 'oil', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Kichadi', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rava', 'curd', 'onion', 'green chilli', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Adai', meal: 'breakfast', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'chana dal', 'urad dal', 'red chilli', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Sambar Rice', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'toor dal', 'tomato', 'tamarind', 'onion', 'sambar powder'], tags: [], ref: '', notes: '' },
      { name: 'Rasam Rice', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'tomato', 'tamarind', 'pepper', 'cumin', 'garlic'], tags: [], ref: '', notes: '' },
      { name: 'Curd Rice', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'curd', 'mustard', 'curry leaves', 'green chilli', 'ginger'], tags: [], ref: '', notes: '' },
      { name: 'Lemon Rice', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'lemon', 'turmeric', 'peanut', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Tamarind Rice', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'tamarind', 'peanut', 'mustard', 'curry leaves', 'sesame'], tags: [], ref: '', notes: '' },
      { name: 'Kootu', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['vegetable', 'coconut', 'urad dal', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Kara Kuzhambu', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['tamarind', 'onion', 'tomato', 'coconut', 'kuzhambu powder', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Mor Kuzhambu', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['curd', 'coconut', 'cumin', 'green chilli', 'turmeric'], tags: [], ref: '', notes: '' },
      { name: 'Paruppu Rice', meal: 'lunch', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'toor dal', 'ghee', 'pepper', 'cumin', 'mustard'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Chapati with Kurma', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['wheat flour', 'vegetable', 'coconut milk', 'onion', 'tomato', 'spice'], tags: [], ref: '', notes: '' },
      { name: 'Idli with Chutney', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'urad dal', 'salt', 'coconut', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Dosa with Chutney', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'urad dal', 'coconut', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Ven Pongal', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rice', 'moong dal', 'ghee', 'pepper', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Dal', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['wheat flour', 'toor dal', 'tomato', 'onion', 'spice'], tags: [], ref: '', notes: '' },
      { name: 'Dinner Upma', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['rava', 'onion', 'green chilli', 'mustard', 'curry leaves', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Pesarattu', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['green moong dal', 'green chilli', 'ginger', 'onion', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Parotta with Salna', meal: 'dinner', cuisine: 'tamil-nadu', diet: 'veg', ingredients: ['wheat flour', 'oil', 'onion', 'tomato', 'spice', 'coconut milk'], tags: [], ref: '', notes: '' },
    ],
  },

  // Tamil Nadu sub-cuisines
  'tamil-nadu:chettinad': {
    breakfast: [
      { name: 'Vellai Paniyaram', meal: 'breakfast', cuisine: 'tamil-nadu:chettinad', diet: 'veg', ingredients: ['rice', 'urad dal', 'coconut', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Kuzhi Paniyaram', meal: 'breakfast', cuisine: 'tamil-nadu:chettinad', diet: 'veg', ingredients: ['rice', 'urad dal', 'onion', 'carrot', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Chettinad Masala Dosa', meal: 'breakfast', cuisine: 'tamil-nadu:chettinad', diet: 'veg', ingredients: ['rice', 'urad dal', 'potato', 'onion', 'pepper', 'fennel'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Chettinad Kara Kuzhambu', meal: 'lunch', cuisine: 'tamil-nadu:chettinad', diet: 'veg', ingredients: ['tamarind', 'shallot', 'tomato', 'fennel', 'pepper', 'kalpasi'], tags: [], ref: '', notes: '' },
      { name: 'Chettinad Chicken Curry', meal: 'lunch', cuisine: 'tamil-nadu:chettinad', diet: 'nonveg', ingredients: ['chicken', 'onion', 'tomato', 'pepper', 'fennel', 'star anise', 'kalpasi', 'coconut'], tags: [], ref: '', notes: '' },
      { name: 'Chettinad Egg Curry', meal: 'lunch', cuisine: 'tamil-nadu:chettinad', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'pepper', 'fennel', 'coconut', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  'tamil-nadu:kongunad': {
    breakfast: [
      { name: 'Kollu Paruppu Dosai', meal: 'breakfast', cuisine: 'tamil-nadu:kongunad', diet: 'veg', ingredients: ['rice', 'horse gram', 'cumin', 'pepper'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Kongunad Kozhi Kuzhambu', meal: 'lunch', cuisine: 'tamil-nadu:kongunad', diet: 'nonveg', ingredients: ['chicken', 'coconut', 'onion', 'tomato', 'fennel', 'poppy seed'], tags: [], ref: '', notes: '' },
      { name: 'Kambu Koozh', meal: 'lunch', cuisine: 'tamil-nadu:kongunad', diet: 'veg', ingredients: ['pearl millet', 'curd', 'salt', 'shallot'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Kongunad Ragi Mudde', meal: 'dinner', cuisine: 'tamil-nadu:kongunad', diet: 'veg', ingredients: ['ragi flour', 'water', 'salt'], tags: [], ref: '', notes: '' },
    ],
  },

  'tamil-nadu:madurai': {
    breakfast: [],
    lunch: [
      { name: 'Madurai Jigarthanda', meal: 'lunch', cuisine: 'tamil-nadu:madurai', diet: 'veg', ingredients: ['milk', 'almond gum', 'sarsaparilla syrup', 'ice cream'], tags: [], ref: '', notes: '' },
      { name: 'Madurai Kari Dosai', meal: 'lunch', cuisine: 'tamil-nadu:madurai', diet: 'nonveg', ingredients: ['rice', 'urad dal', 'mutton', 'onion', 'spice'], tags: [], ref: '', notes: '' },
      { name: 'Madurai Meen Kuzhambu', meal: 'lunch', cuisine: 'tamil-nadu:madurai', diet: 'nonveg', ingredients: ['fish', 'tamarind', 'tomato', 'onion', 'chilli powder', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  'tamil-nadu:thanjavur': {
    breakfast: [],
    lunch: [
      { name: 'Thanjavur Sambar', meal: 'lunch', cuisine: 'tamil-nadu:thanjavur', diet: 'veg', ingredients: ['toor dal', 'drumstick', 'eggplant', 'tamarind', 'sambar powder', 'coconut'], tags: [], ref: '', notes: '' },
      { name: 'Thanjavur Mappillai Samba Rice', meal: 'lunch', cuisine: 'tamil-nadu:thanjavur', diet: 'veg', ingredients: ['mappillai samba rice', 'toor dal', 'ghee', 'pepper'], tags: [], ref: '', notes: '' },
      { name: 'Kavuni Arisi', meal: 'lunch', cuisine: 'tamil-nadu:thanjavur', diet: 'veg', ingredients: ['black rice', 'jaggery', 'coconut milk', 'ghee', 'cashew'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  // =========================================================================
  // KERALA
  // =========================================================================
  'kerala': {
    breakfast: [
      { name: 'Puttu with Kadala Curry', meal: 'breakfast', cuisine: 'kerala', diet: 'veg', ingredients: ['rice flour', 'coconut', 'black chickpea', 'onion', 'coconut oil'], tags: [], ref: '', notes: '' },
      { name: 'Appam', meal: 'breakfast', cuisine: 'kerala', diet: 'veg', ingredients: ['rice', 'coconut milk', 'yeast', 'sugar'], tags: [], ref: '', notes: '' },
      { name: 'Idiyappam with Egg Curry', meal: 'breakfast', cuisine: 'kerala', diet: 'egg', ingredients: ['rice flour', 'egg', 'onion', 'tomato', 'coconut milk', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Dosa with Sambar', meal: 'breakfast', cuisine: 'kerala', diet: 'veg', ingredients: ['rice', 'urad dal', 'toor dal', 'vegetable', 'tamarind', 'sambar powder'], tags: [], ref: '', notes: '' },
      { name: 'Vellayappam', meal: 'breakfast', cuisine: 'kerala', diet: 'veg', ingredients: ['rice', 'coconut', 'sugar', 'yeast'], tags: [], ref: '', notes: '' },
      { name: 'Kerala Egg Roast', meal: 'breakfast', cuisine: 'kerala', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'curry leaves', 'coconut oil', 'chilli powder'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Kerala Sambar', meal: 'lunch', cuisine: 'kerala', diet: 'veg', ingredients: ['toor dal', 'drumstick', 'ash gourd', 'coconut', 'sambar powder', 'coconut oil'], tags: [], ref: '', notes: '' },
      { name: 'Avial', meal: 'lunch', cuisine: 'kerala', diet: 'veg', ingredients: ['mixed vegetable', 'coconut', 'curd', 'curry leaves', 'coconut oil', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Thoran', meal: 'lunch', cuisine: 'kerala', diet: 'veg', ingredients: ['cabbage', 'coconut', 'mustard', 'curry leaves', 'turmeric', 'coconut oil'], tags: [], ref: '', notes: '' },
      { name: 'Erissery', meal: 'lunch', cuisine: 'kerala', diet: 'veg', ingredients: ['pumpkin', 'black chickpea', 'coconut', 'turmeric', 'cumin', 'coconut oil'], tags: [], ref: '', notes: '' },
      { name: 'Olan', meal: 'lunch', cuisine: 'kerala', diet: 'veg', ingredients: ['ash gourd', 'black-eyed pea', 'coconut milk', 'curry leaves', 'coconut oil'], tags: [], ref: '', notes: '' },
      { name: 'Meen Curry', meal: 'lunch', cuisine: 'kerala', diet: 'nonveg', ingredients: ['fish', 'coconut milk', 'kodampuli', 'shallot', 'ginger', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Kerala Chicken Curry', meal: 'lunch', cuisine: 'kerala', diet: 'nonveg', ingredients: ['chicken', 'coconut milk', 'onion', 'tomato', 'ginger', 'curry leaves', 'coconut oil'], tags: [], ref: '', notes: '' },
      { name: 'Parippu Curry', meal: 'lunch', cuisine: 'kerala', diet: 'veg', ingredients: ['moong dal', 'coconut', 'turmeric', 'cumin', 'ghee', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Appam with Stew', meal: 'dinner', cuisine: 'kerala', diet: 'veg', ingredients: ['rice', 'coconut milk', 'potato', 'carrot', 'green pea', 'cardamom', 'clove'], tags: [], ref: '', notes: '' },
      { name: 'Puttu with Pazhampori', meal: 'dinner', cuisine: 'kerala', diet: 'veg', ingredients: ['rice flour', 'coconut', 'banana', 'sugar', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Chapati with Kerala Chicken Curry', meal: 'dinner', cuisine: 'kerala', diet: 'nonveg', ingredients: ['wheat flour', 'chicken', 'coconut milk', 'onion', 'tomato', 'ginger'], tags: [], ref: '', notes: '' },
      { name: 'Idiyappam with Coconut Milk', meal: 'dinner', cuisine: 'kerala', diet: 'veg', ingredients: ['rice flour', 'coconut milk', 'sugar'], tags: [], ref: '', notes: '' },
      { name: 'Kerala Porotta with Beef Fry', meal: 'dinner', cuisine: 'kerala', diet: 'nonveg', ingredients: ['wheat flour', 'egg', 'beef', 'onion', 'curry leaves', 'coconut oil', 'pepper'], tags: [], ref: '', notes: '' },
    ],
  },

  'kerala:malabar': {
    breakfast: [
      { name: 'Pathiri', meal: 'breakfast', cuisine: 'kerala:malabar', diet: 'veg', ingredients: ['rice flour', 'water', 'salt', 'coconut oil'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Malabar Biryani', meal: 'lunch', cuisine: 'kerala:malabar', diet: 'nonveg', ingredients: ['basmati rice', 'chicken', 'onion', 'tomato', 'curd', 'ghee', 'biryani masala'], tags: [], ref: '', notes: '' },
      { name: 'Kadala Curry', meal: 'lunch', cuisine: 'kerala:malabar', diet: 'veg', ingredients: ['black chickpea', 'coconut', 'onion', 'tomato', 'curry leaves', 'coconut oil'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Malabar Parotta with Egg Curry', meal: 'dinner', cuisine: 'kerala:malabar', diet: 'egg', ingredients: ['wheat flour', 'egg', 'onion', 'tomato', 'coconut milk', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
  },

  'kerala:travancore': {
    breakfast: [],
    lunch: [
      { name: 'Travancore Fish Molee', meal: 'lunch', cuisine: 'kerala:travancore', diet: 'nonveg', ingredients: ['fish', 'coconut milk', 'onion', 'ginger', 'green chilli', 'turmeric'], tags: [], ref: '', notes: '' },
      { name: 'Karimeen Pollichathu', meal: 'lunch', cuisine: 'kerala:travancore', diet: 'nonveg', ingredients: ['pearl spot fish', 'coconut oil', 'shallot', 'tomato', 'curry leaves', 'banana leaf'], tags: [], ref: '', notes: '' },
      { name: 'Travancore Avial', meal: 'lunch', cuisine: 'kerala:travancore', diet: 'veg', ingredients: ['drumstick', 'raw banana', 'yam', 'coconut', 'curd', 'coconut oil'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  'kerala:central': {
    breakfast: [],
    lunch: [
      { name: 'Kochi Style Prawn Curry', meal: 'lunch', cuisine: 'kerala:central', diet: 'nonveg', ingredients: ['prawn', 'coconut milk', 'kodampuli', 'shallot', 'curry leaves', 'turmeric'], tags: [], ref: '', notes: '' },
      { name: 'Erachi Ularthiyathu', meal: 'lunch', cuisine: 'kerala:central', diet: 'nonveg', ingredients: ['beef', 'coconut', 'shallot', 'curry leaves', 'coconut oil', 'pepper'], tags: [], ref: '', notes: '' },
      { name: 'Central Kerala Thoran', meal: 'lunch', cuisine: 'kerala:central', diet: 'veg', ingredients: ['beans', 'coconut', 'mustard', 'curry leaves', 'coconut oil'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  'kerala:palakkad': {
    breakfast: [
      { name: 'Palakkad Kozhukattai', meal: 'breakfast', cuisine: 'kerala:palakkad', diet: 'veg', ingredients: ['rice flour', 'coconut', 'jaggery'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Palakkad Sambar', meal: 'lunch', cuisine: 'kerala:palakkad', diet: 'veg', ingredients: ['toor dal', 'drumstick', 'tamarind', 'sambar powder', 'ghee', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Palakkad Parippu', meal: 'lunch', cuisine: 'kerala:palakkad', diet: 'veg', ingredients: ['toor dal', 'coconut', 'ghee', 'cumin', 'mustard'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  // =========================================================================
  // KARNATAKA
  // =========================================================================
  'karnataka': {
    breakfast: [
      { name: 'Rava Idli', meal: 'breakfast', cuisine: 'karnataka', diet: 'veg', ingredients: ['rava', 'curd', 'cashew', 'mustard', 'curry leaves', 'carrot'], tags: [], ref: '', notes: '' },
      { name: 'Bisi Bele Bath', meal: 'breakfast', cuisine: 'karnataka', diet: 'veg', ingredients: ['rice', 'toor dal', 'vegetable', 'bisi bele bath powder', 'tamarind', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Set Dosa', meal: 'breakfast', cuisine: 'karnataka', diet: 'veg', ingredients: ['rice', 'urad dal', 'poha', 'sugar'], tags: [], ref: '', notes: '' },
      { name: 'Akki Roti', meal: 'breakfast', cuisine: 'karnataka', diet: 'veg', ingredients: ['rice flour', 'onion', 'carrot', 'coriander', 'green chilli', 'coconut'], tags: [], ref: '', notes: '' },
      { name: 'Khara Bath', meal: 'breakfast', cuisine: 'karnataka', diet: 'veg', ingredients: ['rava', 'onion', 'vegetable', 'mustard', 'curry leaves', 'ghee'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Vangi Bath', meal: 'lunch', cuisine: 'karnataka', diet: 'veg', ingredients: ['rice', 'eggplant', 'vangi bath powder', 'tamarind', 'peanut', 'coconut'], tags: [], ref: '', notes: '' },
      { name: 'Huli', meal: 'lunch', cuisine: 'karnataka', diet: 'veg', ingredients: ['toor dal', 'vegetable', 'tamarind', 'coconut', 'jaggery', 'mustard'], tags: [], ref: '', notes: '' },
      { name: 'Saaru', meal: 'lunch', cuisine: 'karnataka', diet: 'veg', ingredients: ['tomato', 'tamarind', 'pepper', 'cumin', 'curry leaves', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Gojju', meal: 'lunch', cuisine: 'karnataka', diet: 'veg', ingredients: ['raw mango', 'jaggery', 'coconut', 'tamarind', 'mustard', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Palya', meal: 'lunch', cuisine: 'karnataka', diet: 'veg', ingredients: ['beans', 'coconut', 'mustard', 'urad dal', 'curry leaves', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Karnataka Mutton Curry', meal: 'lunch', cuisine: 'karnataka', diet: 'nonveg', ingredients: ['mutton', 'onion', 'coconut', 'coriander', 'red chilli', 'oil'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Ragi Mudde with Saaru', meal: 'dinner', cuisine: 'karnataka', diet: 'veg', ingredients: ['ragi flour', 'water', 'tomato', 'tamarind', 'pepper', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Jolada Roti with Ennegayi', meal: 'dinner', cuisine: 'karnataka', diet: 'veg', ingredients: ['jowar flour', 'eggplant', 'peanut', 'coconut', 'red chilli', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Chapati with Palya', meal: 'dinner', cuisine: 'karnataka', diet: 'veg', ingredients: ['wheat flour', 'potato', 'coconut', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Set Dosa with Coconut Chutney', meal: 'dinner', cuisine: 'karnataka', diet: 'veg', ingredients: ['rice', 'urad dal', 'poha', 'coconut', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Karnataka Egg Dosa', meal: 'dinner', cuisine: 'karnataka', diet: 'egg', ingredients: ['rice', 'urad dal', 'egg', 'onion', 'green chilli'], tags: [], ref: '', notes: '' },
    ],
  },

  'karnataka:udupi-mangalore': {
    breakfast: [
      { name: 'Neer Dosa', meal: 'breakfast', cuisine: 'karnataka:udupi-mangalore', diet: 'veg', ingredients: ['rice', 'coconut', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Goli Baje', meal: 'breakfast', cuisine: 'karnataka:udupi-mangalore', diet: 'veg', ingredients: ['maida', 'curd', 'coconut', 'green chilli', 'ginger', 'oil'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Kori Rotti', meal: 'lunch', cuisine: 'karnataka:udupi-mangalore', diet: 'nonveg', ingredients: ['rice wafer', 'chicken', 'coconut', 'onion', 'tamarind', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Mangalore Cucumber Sambar', meal: 'lunch', cuisine: 'karnataka:udupi-mangalore', diet: 'veg', ingredients: ['cucumber', 'toor dal', 'coconut', 'tamarind', 'mustard'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  'karnataka:north': {
    breakfast: [
      { name: 'Jolada Roti', meal: 'breakfast', cuisine: 'karnataka:north', diet: 'veg', ingredients: ['jowar flour', 'water', 'salt'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Ennegayi', meal: 'lunch', cuisine: 'karnataka:north', diet: 'veg', ingredients: ['eggplant', 'peanut', 'coconut', 'sesame', 'red chilli', 'jaggery'], tags: [], ref: '', notes: '' },
      { name: 'North Karnataka Soppina Saaru', meal: 'lunch', cuisine: 'karnataka:north', diet: 'veg', ingredients: ['spinach', 'toor dal', 'tamarind', 'garlic', 'red chilli', 'mustard'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Jolada Roti with Shenga Chutney', meal: 'dinner', cuisine: 'karnataka:north', diet: 'veg', ingredients: ['jowar flour', 'peanut', 'garlic', 'red chilli', 'tamarind'], tags: [], ref: '', notes: '' },
    ],
  },

  'karnataka:malnad': {
    breakfast: [],
    lunch: [
      { name: 'Malnad Kadabu', meal: 'lunch', cuisine: 'karnataka:malnad', diet: 'veg', ingredients: ['rice', 'jaggery', 'coconut', 'cardamom'], tags: [], ref: '', notes: '' },
      { name: 'Malnad Pandi Curry', meal: 'lunch', cuisine: 'karnataka:malnad', diet: 'nonveg', ingredients: ['pork', 'kachampuli', 'onion', 'pepper', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Malnad Bamboo Shoot Curry', meal: 'lunch', cuisine: 'karnataka:malnad', diet: 'veg', ingredients: ['bamboo shoot', 'coconut', 'mustard', 'curry leaves', 'turmeric'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  'karnataka:kodava': {
    breakfast: [],
    lunch: [
      { name: 'Kodava Pandi Curry', meal: 'lunch', cuisine: 'karnataka:kodava', diet: 'nonveg', ingredients: ['pork', 'kachampuli', 'garlic', 'pepper', 'coriander', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Kadambuttu', meal: 'lunch', cuisine: 'karnataka:kodava', diet: 'veg', ingredients: ['rice flour', 'water', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Baimbale Curry', meal: 'lunch', cuisine: 'karnataka:kodava', diet: 'veg', ingredients: ['bamboo shoot', 'coconut', 'red chilli', 'garlic', 'mustard'], tags: [], ref: '', notes: '' },
    ],
    dinner: [],
  },

  // =========================================================================
  // ANDHRA
  // =========================================================================
  'andhra': {
    breakfast: [
      { name: 'Pesarattu', meal: 'breakfast', cuisine: 'andhra', diet: 'veg', ingredients: ['green moong dal', 'green chilli', 'ginger', 'cumin', 'onion', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Upma with Allam Pachadi', meal: 'breakfast', cuisine: 'andhra', diet: 'veg', ingredients: ['rava', 'onion', 'mustard', 'ginger', 'green chilli', 'lemon'], tags: [], ref: '', notes: '' },
      { name: 'Andhra Idli with Peanut Chutney', meal: 'breakfast', cuisine: 'andhra', diet: 'veg', ingredients: ['rice', 'urad dal', 'peanut', 'red chilli', 'garlic', 'tamarind'], tags: [], ref: '', notes: '' },
      { name: 'Minapa Rotte', meal: 'breakfast', cuisine: 'andhra', diet: 'veg', ingredients: ['urad dal', 'rice flour', 'cumin', 'onion', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Andhra Pongal', meal: 'breakfast', cuisine: 'andhra', diet: 'veg', ingredients: ['rice', 'moong dal', 'pepper', 'cumin', 'ghee', 'ginger'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Gongura Pachadi with Rice', meal: 'lunch', cuisine: 'andhra', diet: 'veg', ingredients: ['rice', 'gongura leaf', 'red chilli', 'mustard', 'garlic', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Gutti Vankaya Kura', meal: 'lunch', cuisine: 'andhra', diet: 'veg', ingredients: ['eggplant', 'peanut', 'sesame', 'coconut', 'tamarind', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Pappu with Rice', meal: 'lunch', cuisine: 'andhra', diet: 'veg', ingredients: ['toor dal', 'tomato', 'turmeric', 'mustard', 'cumin', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Andhra Chicken Curry', meal: 'lunch', cuisine: 'andhra', diet: 'nonveg', ingredients: ['chicken', 'onion', 'tomato', 'red chilli', 'curry leaves', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Chepala Pulusu', meal: 'lunch', cuisine: 'andhra', diet: 'nonveg', ingredients: ['fish', 'tamarind', 'onion', 'tomato', 'red chilli', 'fenugreek', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Andhra Egg Pulusu', meal: 'lunch', cuisine: 'andhra', diet: 'egg', ingredients: ['egg', 'tamarind', 'onion', 'tomato', 'red chilli', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Pesarattu with Ginger Chutney', meal: 'dinner', cuisine: 'andhra', diet: 'veg', ingredients: ['green moong dal', 'ginger', 'green chilli', 'onion', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Andhra Dal', meal: 'dinner', cuisine: 'andhra', diet: 'veg', ingredients: ['wheat flour', 'toor dal', 'tomato', 'tamarind', 'red chilli', 'mustard'], tags: [], ref: '', notes: '' },
      { name: 'Andhra Tomato Rice', meal: 'dinner', cuisine: 'andhra', diet: 'veg', ingredients: ['rice', 'tomato', 'peanut', 'red chilli', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Dosa with Andhra Chutney', meal: 'dinner', cuisine: 'andhra', diet: 'veg', ingredients: ['rice', 'urad dal', 'red chilli', 'garlic', 'tamarind'], tags: [], ref: '', notes: '' },
      { name: 'Andhra Egg Fried Rice', meal: 'dinner', cuisine: 'andhra', diet: 'egg', ingredients: ['rice', 'egg', 'onion', 'green chilli', 'soy sauce', 'oil'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // TELANGANA
  // =========================================================================
  'telangana': {
    breakfast: [
      { name: 'Sakinalu', meal: 'breakfast', cuisine: 'telangana', diet: 'veg', ingredients: ['rice flour', 'sesame', 'cumin', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Pesarattu', meal: 'breakfast', cuisine: 'telangana', diet: 'veg', ingredients: ['green moong dal', 'rice', 'ginger', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Jonna Rotte', meal: 'breakfast', cuisine: 'telangana', diet: 'veg', ingredients: ['jowar flour', 'water', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Sarva Pindi', meal: 'breakfast', cuisine: 'telangana', diet: 'veg', ingredients: ['rice flour', 'chana dal', 'peanut', 'sesame', 'red chilli', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Upma', meal: 'breakfast', cuisine: 'telangana', diet: 'veg', ingredients: ['broken wheat', 'onion', 'mustard', 'green chilli', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Telangana Mudda Pappu', meal: 'lunch', cuisine: 'telangana', diet: 'veg', ingredients: ['toor dal', 'green chilli', 'ghee', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Golichina Mamsam', meal: 'lunch', cuisine: 'telangana', diet: 'nonveg', ingredients: ['mutton', 'onion', 'ginger garlic paste', 'red chilli', 'coriander', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Tomato Pappu', meal: 'lunch', cuisine: 'telangana', diet: 'veg', ingredients: ['toor dal', 'tomato', 'turmeric', 'mustard', 'red chilli', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Bachali Kura', meal: 'lunch', cuisine: 'telangana', diet: 'veg', ingredients: ['malabar spinach', 'garlic', 'red chilli', 'mustard', 'turmeric'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Chicken Fry', meal: 'lunch', cuisine: 'telangana', diet: 'nonveg', ingredients: ['chicken', 'onion', 'curry leaves', 'red chilli', 'ginger garlic paste', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Egg Curry', meal: 'lunch', cuisine: 'telangana', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'red chilli', 'turmeric', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Jonna Rotte with Brinjal Curry', meal: 'dinner', cuisine: 'telangana', diet: 'veg', ingredients: ['jowar flour', 'eggplant', 'peanut', 'sesame', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Mudda Pappu', meal: 'dinner', cuisine: 'telangana', diet: 'veg', ingredients: ['wheat flour', 'toor dal', 'green chilli', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Biryani', meal: 'dinner', cuisine: 'telangana', diet: 'nonveg', ingredients: ['basmati rice', 'mutton', 'onion', 'curd', 'ghee', 'biryani masala'], tags: [], ref: '', notes: '' },
      { name: 'Dosa with Peanut Chutney', meal: 'dinner', cuisine: 'telangana', diet: 'veg', ingredients: ['rice', 'urad dal', 'peanut', 'red chilli', 'garlic'], tags: [], ref: '', notes: '' },
      { name: 'Telangana Egg Biryani', meal: 'dinner', cuisine: 'telangana', diet: 'egg', ingredients: ['basmati rice', 'egg', 'onion', 'curd', 'ghee', 'biryani masala'], tags: [], ref: '', notes: '' },
    ],
  },

  'telangana:hyderabadi': {
    breakfast: [],
    lunch: [
      { name: 'Hyderabadi Biryani', meal: 'lunch', cuisine: 'telangana:hyderabadi', diet: 'nonveg', ingredients: ['basmati rice', 'chicken', 'curd', 'onion', 'ghee', 'saffron', 'biryani masala'], tags: [], ref: '', notes: '' },
      { name: 'Hyderabadi Haleem', meal: 'lunch', cuisine: 'telangana:hyderabadi', diet: 'nonveg', ingredients: ['wheat', 'mutton', 'ghee', 'onion', 'ginger garlic paste', 'garam masala'], tags: [], ref: '', notes: '' },
      { name: 'Hyderabadi Marag', meal: 'lunch', cuisine: 'telangana:hyderabadi', diet: 'nonveg', ingredients: ['mutton bone', 'onion', 'ginger', 'garlic', 'pepper', 'coriander'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Hyderabadi Egg Biryani', meal: 'dinner', cuisine: 'telangana:hyderabadi', diet: 'egg', ingredients: ['basmati rice', 'egg', 'onion', 'curd', 'ghee', 'saffron', 'biryani masala'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // GOAN
  // =========================================================================
  'goan': {
    breakfast: [
      { name: 'Poee with Chutney', meal: 'breakfast', cuisine: 'goan', diet: 'veg', ingredients: ['wheat flour', 'toddy', 'jaggery', 'coconut', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Goan Pao with Bhaji', meal: 'breakfast', cuisine: 'goan', diet: 'veg', ingredients: ['pao bread', 'potato', 'onion', 'turmeric', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Goan Egg Fry', meal: 'breakfast', cuisine: 'goan', diet: 'egg', ingredients: ['egg', 'onion', 'green chilli', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Sanna', meal: 'breakfast', cuisine: 'goan', diet: 'veg', ingredients: ['rice', 'coconut', 'toddy', 'sugar'], tags: [], ref: '', notes: '' },
      { name: 'Goan Banana Fritters', meal: 'breakfast', cuisine: 'goan', diet: 'veg', ingredients: ['banana', 'wheat flour', 'sugar', 'cardamom', 'oil'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Goan Fish Curry Rice', meal: 'lunch', cuisine: 'goan', diet: 'nonveg', ingredients: ['fish', 'coconut', 'tamarind', 'red chilli', 'turmeric', 'rice'], tags: [], ref: '', notes: '' },
      { name: 'Vindaloo', meal: 'lunch', cuisine: 'goan', diet: 'nonveg', ingredients: ['pork', 'vinegar', 'garlic', 'red chilli', 'cumin', 'cinnamon'], tags: [], ref: '', notes: '' },
      { name: 'Xacuti', meal: 'lunch', cuisine: 'goan', diet: 'nonveg', ingredients: ['chicken', 'coconut', 'poppy seed', 'star anise', 'cinnamon', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Goan Dalitoy', meal: 'lunch', cuisine: 'goan', diet: 'veg', ingredients: ['toor dal', 'coconut', 'kokum', 'turmeric', 'cumin', 'garlic'], tags: [], ref: '', notes: '' },
      { name: 'Goan Vegetable Caldeen', meal: 'lunch', cuisine: 'goan', diet: 'veg', ingredients: ['mixed vegetable', 'coconut milk', 'green chilli', 'turmeric', 'coriander', 'tamarind'], tags: [], ref: '', notes: '' },
      { name: 'Goan Prawn Balchao', meal: 'lunch', cuisine: 'goan', diet: 'nonveg', ingredients: ['prawn', 'vinegar', 'onion', 'tomato', 'red chilli', 'sugar'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Pao with Goan Chicken Cafreal', meal: 'dinner', cuisine: 'goan', diet: 'nonveg', ingredients: ['pao bread', 'chicken', 'coriander', 'green chilli', 'ginger', 'lime'], tags: [], ref: '', notes: '' },
      { name: 'Sanna with Goan Curry', meal: 'dinner', cuisine: 'goan', diet: 'veg', ingredients: ['rice', 'coconut', 'toddy', 'coconut milk', 'vegetable'], tags: [], ref: '', notes: '' },
      { name: 'Goan Prawn Pulao', meal: 'dinner', cuisine: 'goan', diet: 'nonveg', ingredients: ['rice', 'prawn', 'onion', 'tomato', 'coconut milk', 'spice'], tags: [], ref: '', notes: '' },
      { name: 'Goan Mushroom Xacuti', meal: 'dinner', cuisine: 'goan', diet: 'veg', ingredients: ['mushroom', 'coconut', 'poppy seed', 'cinnamon', 'red chilli', 'onion'], tags: [], ref: '', notes: '' },
      { name: 'Goan Egg Curry', meal: 'dinner', cuisine: 'goan', diet: 'egg', ingredients: ['egg', 'coconut', 'tamarind', 'red chilli', 'onion', 'turmeric'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // PUNJABI
  // =========================================================================
  'punjabi': {
    breakfast: [
      { name: 'Aloo Paratha', meal: 'breakfast', cuisine: 'punjabi', diet: 'veg', ingredients: ['wheat flour', 'potato', 'green chilli', 'coriander', 'ghee', 'curd'], tags: [], ref: '', notes: '' },
      { name: 'Gobi Paratha', meal: 'breakfast', cuisine: 'punjabi', diet: 'veg', ingredients: ['wheat flour', 'cauliflower', 'green chilli', 'coriander', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Chole Bhature', meal: 'breakfast', cuisine: 'punjabi', diet: 'veg', ingredients: ['chickpea', 'maida', 'onion', 'tomato', 'chole masala', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Punjabi Omelette with Paratha', meal: 'breakfast', cuisine: 'punjabi', diet: 'egg', ingredients: ['egg', 'onion', 'green chilli', 'wheat flour', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Poha', meal: 'breakfast', cuisine: 'punjabi', diet: 'veg', ingredients: ['poha', 'onion', 'peanut', 'mustard', 'turmeric', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Rajma Chawal', meal: 'lunch', cuisine: 'punjabi', diet: 'veg', ingredients: ['rajma', 'rice', 'onion', 'tomato', 'ginger', 'garam masala'], tags: [], ref: '', notes: '' },
      { name: 'Chole with Rice', meal: 'lunch', cuisine: 'punjabi', diet: 'veg', ingredients: ['chickpea', 'rice', 'onion', 'tomato', 'chole masala', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Dal Makhani', meal: 'lunch', cuisine: 'punjabi', diet: 'veg', ingredients: ['urad dal', 'rajma', 'butter', 'cream', 'onion', 'tomato', 'garam masala'], tags: [], ref: '', notes: '' },
      { name: 'Sarson da Saag with Makki Roti', meal: 'lunch', cuisine: 'punjabi', diet: 'veg', ingredients: ['mustard green', 'spinach', 'maize flour', 'ghee', 'onion', 'ginger'], tags: [], ref: '', notes: '' },
      { name: 'Butter Chicken', meal: 'lunch', cuisine: 'punjabi', diet: 'nonveg', ingredients: ['chicken', 'butter', 'cream', 'tomato', 'cashew', 'garam masala', 'kasuri methi'], tags: [], ref: '', notes: '' },
      { name: 'Punjabi Kadhi Chawal', meal: 'lunch', cuisine: 'punjabi', diet: 'veg', ingredients: ['curd', 'besan', 'rice', 'onion', 'mustard', 'turmeric', 'fenugreek'], tags: [], ref: '', notes: '' },
      { name: 'Punjabi Egg Curry', meal: 'lunch', cuisine: 'punjabi', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'garam masala', 'ginger', 'garlic'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Roti with Paneer Bhurji', meal: 'dinner', cuisine: 'punjabi', diet: 'veg', ingredients: ['wheat flour', 'paneer', 'onion', 'tomato', 'green chilli', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Aloo Gobi with Roti', meal: 'dinner', cuisine: 'punjabi', diet: 'veg', ingredients: ['wheat flour', 'potato', 'cauliflower', 'turmeric', 'cumin', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Dal Fry with Rice', meal: 'dinner', cuisine: 'punjabi', diet: 'veg', ingredients: ['toor dal', 'rice', 'onion', 'tomato', 'garlic', 'cumin', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Chicken Roti', meal: 'dinner', cuisine: 'punjabi', diet: 'nonveg', ingredients: ['wheat flour', 'chicken', 'onion', 'tomato', 'garam masala', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Punjabi Egg Bhurji with Roti', meal: 'dinner', cuisine: 'punjabi', diet: 'egg', ingredients: ['wheat flour', 'egg', 'onion', 'tomato', 'green chilli', 'coriander'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // BENGALI
  // =========================================================================
  'bengali': {
    breakfast: [
      { name: 'Luchi with Aloor Dom', meal: 'breakfast', cuisine: 'bengali', diet: 'veg', ingredients: ['maida', 'potato', 'ghee', 'cumin', 'bay leaf', 'ginger'], tags: [], ref: '', notes: '' },
      { name: 'Radhaballabhi', meal: 'breakfast', cuisine: 'bengali', diet: 'veg', ingredients: ['maida', 'urad dal', 'ginger', 'cumin', 'asafoetida', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Koraishutir Kochuri', meal: 'breakfast', cuisine: 'bengali', diet: 'veg', ingredients: ['maida', 'green pea', 'ginger', 'cumin', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Bengali Egg Roll', meal: 'breakfast', cuisine: 'bengali', diet: 'egg', ingredients: ['maida', 'egg', 'onion', 'green chilli', 'lemon', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Panta Bhat', meal: 'breakfast', cuisine: 'bengali', diet: 'veg', ingredients: ['rice', 'water', 'salt', 'onion', 'green chilli'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Shukto', meal: 'lunch', cuisine: 'bengali', diet: 'veg', ingredients: ['bitter gourd', 'potato', 'drumstick', 'milk', 'mustard paste', 'panch phoron'], tags: [], ref: '', notes: '' },
      { name: 'Machher Jhol with Rice', meal: 'lunch', cuisine: 'bengali', diet: 'nonveg', ingredients: ['fish', 'rice', 'potato', 'turmeric', 'cumin', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Cholar Dal', meal: 'lunch', cuisine: 'bengali', diet: 'veg', ingredients: ['chana dal', 'coconut', 'ghee', 'bay leaf', 'cumin', 'raisin'], tags: [], ref: '', notes: '' },
      { name: 'Mochar Ghonto', meal: 'lunch', cuisine: 'bengali', diet: 'veg', ingredients: ['banana flower', 'potato', 'coconut', 'cumin', 'bay leaf', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Bengali Mangshor Jhol', meal: 'lunch', cuisine: 'bengali', diet: 'nonveg', ingredients: ['mutton', 'potato', 'onion', 'ginger garlic paste', 'garam masala', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Dimer Dalna', meal: 'lunch', cuisine: 'bengali', diet: 'egg', ingredients: ['egg', 'potato', 'onion', 'tomato', 'turmeric', 'cumin', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Aloo Posto', meal: 'lunch', cuisine: 'bengali', diet: 'veg', ingredients: ['potato', 'poppy seed', 'green chilli', 'mustard oil', 'turmeric'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Roti with Cholar Dal', meal: 'dinner', cuisine: 'bengali', diet: 'veg', ingredients: ['wheat flour', 'chana dal', 'coconut', 'ghee', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Bengali Khichuri', meal: 'dinner', cuisine: 'bengali', diet: 'veg', ingredients: ['rice', 'moong dal', 'potato', 'cauliflower', 'ghee', 'cumin', 'bay leaf'], tags: [], ref: '', notes: '' },
      { name: 'Fish Fry with Rice', meal: 'dinner', cuisine: 'bengali', diet: 'nonveg', ingredients: ['fish', 'rice', 'mustard paste', 'turmeric', 'salt', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Phulko Luchi with Egg Curry', meal: 'dinner', cuisine: 'bengali', diet: 'egg', ingredients: ['maida', 'egg', 'onion', 'tomato', 'garam masala', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Bengali Moong Dal with Rice', meal: 'dinner', cuisine: 'bengali', diet: 'veg', ingredients: ['moong dal', 'rice', 'ghee', 'cumin', 'bay leaf'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // MARATHI
  // =========================================================================
  'marathi': {
    breakfast: [
      { name: 'Poha', meal: 'breakfast', cuisine: 'marathi', diet: 'veg', ingredients: ['poha', 'onion', 'potato', 'peanut', 'turmeric', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Thalipeeth', meal: 'breakfast', cuisine: 'marathi', diet: 'veg', ingredients: ['bhajani flour', 'onion', 'coriander', 'cumin', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Sabudana Khichdi', meal: 'breakfast', cuisine: 'marathi', diet: 'veg', ingredients: ['sabudana', 'potato', 'peanut', 'cumin', 'green chilli', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Misal Pav', meal: 'breakfast', cuisine: 'marathi', diet: 'veg', ingredients: ['moth bean sprout', 'pav', 'onion', 'farsan', 'red chilli', 'garlic'], tags: [], ref: '', notes: '' },
      { name: 'Kanda Bhaji', meal: 'breakfast', cuisine: 'marathi', diet: 'veg', ingredients: ['onion', 'besan', 'rice flour', 'red chilli', 'oil'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Varan Bhaat', meal: 'lunch', cuisine: 'marathi', diet: 'veg', ingredients: ['toor dal', 'rice', 'ghee', 'turmeric', 'salt'], tags: [], ref: '', notes: '' },
      { name: 'Pithla Bhakri', meal: 'lunch', cuisine: 'marathi', diet: 'veg', ingredients: ['besan', 'jowar flour', 'onion', 'garlic', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Usal', meal: 'lunch', cuisine: 'marathi', diet: 'veg', ingredients: ['sprouted moth', 'onion', 'tomato', 'goda masala', 'coconut', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Bharli Vangi', meal: 'lunch', cuisine: 'marathi', diet: 'veg', ingredients: ['eggplant', 'peanut', 'coconut', 'goda masala', 'tamarind', 'jaggery'], tags: [], ref: '', notes: '' },
      { name: 'Kombdi Vade', meal: 'lunch', cuisine: 'marathi', diet: 'nonveg', ingredients: ['chicken', 'rice flour', 'coconut', 'onion', 'red chilli', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Marathi Egg Bhurji', meal: 'lunch', cuisine: 'marathi', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'green chilli', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Chapati with Batata Bhaji', meal: 'dinner', cuisine: 'marathi', diet: 'veg', ingredients: ['wheat flour', 'potato', 'onion', 'mustard', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Bhakri with Thecha', meal: 'dinner', cuisine: 'marathi', diet: 'veg', ingredients: ['jowar flour', 'green chilli', 'garlic', 'peanut', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Puran Poli', meal: 'dinner', cuisine: 'marathi', diet: 'veg', ingredients: ['wheat flour', 'chana dal', 'jaggery', 'cardamom', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Kolhapuri Chicken', meal: 'dinner', cuisine: 'marathi', diet: 'nonveg', ingredients: ['wheat flour', 'chicken', 'onion', 'coconut', 'red chilli', 'kolhapuri masala'], tags: [], ref: '', notes: '' },
      { name: 'Marathi Egg Curry with Rice', meal: 'dinner', cuisine: 'marathi', diet: 'egg', ingredients: ['rice', 'egg', 'onion', 'tomato', 'goda masala', 'coconut'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // GUJARATI
  // =========================================================================
  'gujarati': {
    breakfast: [
      { name: 'Thepla', meal: 'breakfast', cuisine: 'gujarati', diet: 'veg', ingredients: ['wheat flour', 'fenugreek leaf', 'curd', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Dhokla', meal: 'breakfast', cuisine: 'gujarati', diet: 'veg', ingredients: ['besan', 'curd', 'mustard', 'green chilli', 'sugar', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Handvo', meal: 'breakfast', cuisine: 'gujarati', diet: 'veg', ingredients: ['rice', 'chana dal', 'toor dal', 'bottle gourd', 'sesame', 'mustard'], tags: [], ref: '', notes: '' },
      { name: 'Khaman', meal: 'breakfast', cuisine: 'gujarati', diet: 'veg', ingredients: ['besan', 'citric acid', 'sugar', 'mustard', 'curry leaves', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Fafda with Jalebi', meal: 'breakfast', cuisine: 'gujarati', diet: 'veg', ingredients: ['besan', 'turmeric', 'carom seed', 'oil', 'maida', 'sugar', 'saffron'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Dal Dhokli', meal: 'lunch', cuisine: 'gujarati', diet: 'veg', ingredients: ['toor dal', 'wheat flour', 'peanut', 'jaggery', 'tamarind', 'turmeric'], tags: [], ref: '', notes: '' },
      { name: 'Undhiyu', meal: 'lunch', cuisine: 'gujarati', diet: 'veg', ingredients: ['surti papdi', 'purple yam', 'potato', 'eggplant', 'methi muthia', 'coconut', 'jaggery'], tags: [], ref: '', notes: '' },
      { name: 'Gujarati Kadhi', meal: 'lunch', cuisine: 'gujarati', diet: 'veg', ingredients: ['curd', 'besan', 'sugar', 'ginger', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Sev Tameta nu Shaak', meal: 'lunch', cuisine: 'gujarati', diet: 'veg', ingredients: ['tomato', 'sev', 'peanut', 'jaggery', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
      { name: 'Ringan nu Olo', meal: 'lunch', cuisine: 'gujarati', diet: 'veg', ingredients: ['eggplant', 'peanut', 'jaggery', 'tamarind', 'sesame', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Gujarati Dal with Rice', meal: 'lunch', cuisine: 'gujarati', diet: 'veg', ingredients: ['toor dal', 'rice', 'peanut', 'jaggery', 'lemon', 'mustard', 'curry leaves'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Rotla with Ringan Bharta', meal: 'dinner', cuisine: 'gujarati', diet: 'veg', ingredients: ['bajra flour', 'eggplant', 'onion', 'garlic', 'oil', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Puri with Shaak', meal: 'dinner', cuisine: 'gujarati', diet: 'veg', ingredients: ['wheat flour', 'potato', 'onion', 'turmeric', 'mustard', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Khichdi Kadhi', meal: 'dinner', cuisine: 'gujarati', diet: 'veg', ingredients: ['rice', 'moong dal', 'curd', 'besan', 'ghee', 'cumin', 'mustard'], tags: [], ref: '', notes: '' },
      { name: 'Thepla with Curd', meal: 'dinner', cuisine: 'gujarati', diet: 'veg', ingredients: ['wheat flour', 'fenugreek leaf', 'curd', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Muthia', meal: 'dinner', cuisine: 'gujarati', diet: 'veg', ingredients: ['wheat flour', 'bottle gourd', 'fenugreek leaf', 'sesame', 'mustard', 'oil'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // RAJASTHANI
  // =========================================================================
  'rajasthani': {
    breakfast: [
      { name: 'Pyaaz Kachori', meal: 'breakfast', cuisine: 'rajasthani', diet: 'veg', ingredients: ['maida', 'onion', 'fennel', 'red chilli', 'coriander', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Bajra Roti with Lehsun Chutney', meal: 'breakfast', cuisine: 'rajasthani', diet: 'veg', ingredients: ['bajra flour', 'garlic', 'red chilli', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Mawa Kachori', meal: 'breakfast', cuisine: 'rajasthani', diet: 'veg', ingredients: ['maida', 'khoya', 'dry fruit', 'sugar', 'cardamom', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Dal Baati', meal: 'breakfast', cuisine: 'rajasthani', diet: 'veg', ingredients: ['wheat flour', 'moong dal', 'chana dal', 'ghee', 'cumin', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Rajasthani Mirchi Vada', meal: 'breakfast', cuisine: 'rajasthani', diet: 'veg', ingredients: ['green chilli', 'potato', 'besan', 'coriander', 'oil'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Dal Baati Churma', meal: 'lunch', cuisine: 'rajasthani', diet: 'veg', ingredients: ['wheat flour', 'moong dal', 'chana dal', 'ghee', 'jaggery', 'cumin'], tags: [], ref: '', notes: '' },
      { name: 'Gatte ki Sabzi', meal: 'lunch', cuisine: 'rajasthani', diet: 'veg', ingredients: ['besan', 'curd', 'cumin', 'red chilli', 'turmeric', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Ker Sangri', meal: 'lunch', cuisine: 'rajasthani', diet: 'veg', ingredients: ['ker berry', 'sangri bean', 'red chilli', 'mustard oil', 'cumin', 'amchur'], tags: [], ref: '', notes: '' },
      { name: 'Papad ki Sabzi', meal: 'lunch', cuisine: 'rajasthani', diet: 'veg', ingredients: ['papad', 'curd', 'cumin', 'red chilli', 'turmeric', 'coriander'], tags: [], ref: '', notes: '' },
      { name: 'Rajasthani Laal Maas', meal: 'lunch', cuisine: 'rajasthani', diet: 'nonveg', ingredients: ['mutton', 'curd', 'garlic', 'red chilli', 'mustard oil', 'onion'], tags: [], ref: '', notes: '' },
      { name: 'Rajasthani Egg Curry', meal: 'lunch', cuisine: 'rajasthani', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'curd', 'red chilli', 'turmeric'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Bajra Roti with Gatte ki Sabzi', meal: 'dinner', cuisine: 'rajasthani', diet: 'veg', ingredients: ['bajra flour', 'besan', 'curd', 'cumin', 'red chilli', 'ghee'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Rajasthani Kadhi', meal: 'dinner', cuisine: 'rajasthani', diet: 'veg', ingredients: ['wheat flour', 'besan', 'curd', 'cumin', 'mustard', 'red chilli'], tags: [], ref: '', notes: '' },
      { name: 'Rajasthani Khichdi', meal: 'dinner', cuisine: 'rajasthani', diet: 'veg', ingredients: ['rice', 'moong dal', 'ghee', 'cumin', 'turmeric', 'green chilli'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Ker Sangri', meal: 'dinner', cuisine: 'rajasthani', diet: 'veg', ingredients: ['wheat flour', 'ker berry', 'sangri bean', 'red chilli', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Rajasthani Safed Maas', meal: 'dinner', cuisine: 'rajasthani', diet: 'nonveg', ingredients: ['mutton', 'curd', 'cream', 'cashew', 'cardamom', 'ghee'], tags: [], ref: '', notes: '' },
    ],
  },

  // =========================================================================
  // KASHMIRI
  // =========================================================================
  'kashmiri': {
    breakfast: [
      { name: 'Kashmiri Kulcha', meal: 'breakfast', cuisine: 'kashmiri', diet: 'veg', ingredients: ['maida', 'milk', 'sugar', 'ghee', 'sesame', 'poppy seed'], tags: [], ref: '', notes: '' },
      { name: 'Sheermal', meal: 'breakfast', cuisine: 'kashmiri', diet: 'veg', ingredients: ['maida', 'milk', 'ghee', 'saffron', 'sugar', 'cardamom'], tags: [], ref: '', notes: '' },
      { name: 'Kashmiri Noon Chai with Girda', meal: 'breakfast', cuisine: 'kashmiri', diet: 'veg', ingredients: ['green tea', 'milk', 'baking soda', 'salt', 'wheat flour'], tags: [], ref: '', notes: '' },
      { name: 'Kashmiri Omelette', meal: 'breakfast', cuisine: 'kashmiri', diet: 'egg', ingredients: ['egg', 'onion', 'tomato', 'green chilli', 'kashmiri chilli', 'oil'], tags: [], ref: '', notes: '' },
      { name: 'Tchot', meal: 'breakfast', cuisine: 'kashmiri', diet: 'veg', ingredients: ['wheat flour', 'ghee', 'salt'], tags: [], ref: '', notes: '' },
    ],
    lunch: [
      { name: 'Rogan Josh', meal: 'lunch', cuisine: 'kashmiri', diet: 'nonveg', ingredients: ['mutton', 'curd', 'kashmiri chilli', 'fennel', 'ginger powder', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Dum Aloo Kashmiri', meal: 'lunch', cuisine: 'kashmiri', diet: 'veg', ingredients: ['potato', 'curd', 'kashmiri chilli', 'fennel', 'ginger powder', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Rajma Gogji', meal: 'lunch', cuisine: 'kashmiri', diet: 'veg', ingredients: ['rajma', 'turnip', 'ginger powder', 'fennel', 'asafoetida', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Nadru Yakhni', meal: 'lunch', cuisine: 'kashmiri', diet: 'veg', ingredients: ['lotus stem', 'curd', 'fennel', 'cardamom', 'bay leaf', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Kashmiri Fried Fish', meal: 'lunch', cuisine: 'kashmiri', diet: 'nonveg', ingredients: ['fish', 'besan', 'kashmiri chilli', 'ginger', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Haak Saag', meal: 'lunch', cuisine: 'kashmiri', diet: 'veg', ingredients: ['collard green', 'mustard oil', 'red chilli', 'asafoetida', 'water'], tags: [], ref: '', notes: '' },
    ],
    dinner: [
      { name: 'Rice with Dum Aloo', meal: 'dinner', cuisine: 'kashmiri', diet: 'veg', ingredients: ['rice', 'potato', 'curd', 'kashmiri chilli', 'fennel', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Kashmiri Pulao', meal: 'dinner', cuisine: 'kashmiri', diet: 'veg', ingredients: ['basmati rice', 'dry fruit', 'saffron', 'ghee', 'cardamom', 'cinnamon'], tags: [], ref: '', notes: '' },
      { name: 'Rice with Rogan Josh', meal: 'dinner', cuisine: 'kashmiri', diet: 'nonveg', ingredients: ['basmati rice', 'mutton', 'curd', 'kashmiri chilli', 'fennel', 'mustard oil'], tags: [], ref: '', notes: '' },
      { name: 'Roti with Haak Saag', meal: 'dinner', cuisine: 'kashmiri', diet: 'veg', ingredients: ['wheat flour', 'collard green', 'mustard oil', 'red chilli', 'asafoetida'], tags: [], ref: '', notes: '' },
      { name: 'Kashmiri Egg Curry with Rice', meal: 'dinner', cuisine: 'kashmiri', diet: 'egg', ingredients: ['rice', 'egg', 'curd', 'kashmiri chilli', 'fennel', 'ginger powder'], tags: [], ref: '', notes: '' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Seeding function
// ---------------------------------------------------------------------------
export function seedCuisine(cuisineKey, diet, existingItems = []) {
  const catalog = SEEDS[cuisineKey];
  if (!catalog) return [];

  const allowedDiets = new Set(DIET_ALLOWED[diet] || DIET_ALLOWED.all);

  // Check if already seeded at this diet tier
  const metaKey = `seeded:${cuisineKey}:${diet}`;
  const alreadySeeded = existingItems.some(
    (item) => item.type === 'meta' && item.id === metaKey
  );
  if (alreadySeeded) return [];

  const newItems = [];
  const existingIds = new Set(existingItems.map((i) => i.id));

  for (const mealType of ['breakfast', 'lunch', 'dinner']) {
    const dishes = catalog[mealType] || [];
    dishes.forEach((dish, n) => {
      if (!allowedDiets.has(dish.diet)) return;
      const id = `seed-${cuisineKey}-${mealType}-${n}`;
      if (existingIds.has(id)) return; // already exists (idempotent)
      newItems.push({
        id,
        type: 'dish',
        name: dish.name,
        meal: dish.meal,
        cuisine: dish.cuisine,
        diet: dish.diet,
        ingredients: dish.ingredients,
        tags: dish.tags,
        ref: dish.ref,
        notes: dish.notes,
        deleted: false,
        deleted_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        dirty: 1,
      });
    });
  }

  // Add a meta marker so re-seeding is idempotent
  if (newItems.length > 0) {
    newItems.push({
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

  return newItems;
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
