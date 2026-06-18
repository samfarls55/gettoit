export const GOOGLE_NEARBY_PRIMARY_TYPE_LIMIT = 50;

export const GOOGLE_Q1_CUISINE_PRIMARY_TYPES = Object.freeze(
  {
    american: [
      "american_restaurant",
      "barbecue_restaurant",
      "hamburger_restaurant",
      "steak_house",
      "diner",
      "soul_food_restaurant",
    ],
    mexican: [
      "mexican_restaurant",
      "taco_restaurant",
      "tex_mex_restaurant",
      "burrito_restaurant",
    ],
    italian: [
      "italian_restaurant",
      "pizza_restaurant",
    ],
    japanese: [
      "japanese_restaurant",
      "ramen_restaurant",
      "sushi_restaurant",
      "japanese_izakaya_restaurant",
      "yakitori_restaurant",
      "yakiniku_restaurant",
    ],
    chinese: [
      "chinese_restaurant",
      "dim_sum_restaurant",
      "dumpling_restaurant",
      "chinese_noodle_restaurant",
      "hot_pot_restaurant",
    ],
    thai: [
      "thai_restaurant",
    ],
    indian: [
      "indian_restaurant",
      "north_indian_restaurant",
      "south_indian_restaurant",
    ],
    mediterranean: [
      "mediterranean_restaurant",
      "greek_restaurant",
    ],
    middle_eastern: [
      "middle_eastern_restaurant",
      "lebanese_restaurant",
      "falafel_restaurant",
      "shawarma_restaurant",
      "kebab_shop",
      "turkish_restaurant",
      "persian_restaurant",
    ],
    korean: [
      "korean_restaurant",
      "korean_barbecue_restaurant",
    ],
    vietnamese: [
      "vietnamese_restaurant",
    ],
    seafood: [
      "seafood_restaurant",
      "fish_and_chips_restaurant",
      "oyster_bar_restaurant",
    ],
    comfort_food: [
      "diner",
      "family_restaurant",
      "breakfast_restaurant",
      "brunch_restaurant",
      "fast_food_restaurant",
      "sandwich_shop",
      "chicken_restaurant",
      "chicken_wings_restaurant",
      "soup_restaurant",
      "hamburger_restaurant",
      "barbecue_restaurant",
      "pizza_restaurant",
      "soul_food_restaurant",
    ],
  } as const,
);

export type GoogleQ1CuisineId = keyof typeof GOOGLE_Q1_CUISINE_PRIMARY_TYPES;

const NO_PREFERENCE_CUISINES = new Set([
  "no_preference",
  "nopreference",
  "no preference",
  "none",
]);

function normalizeCuisineId(value: string): GoogleQ1CuisineId | null {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    NO_PREFERENCE_CUISINES.has(normalized) ||
    NO_PREFERENCE_CUISINES.has(value.trim().toLowerCase())
  ) {
    return null;
  }
  return normalized in GOOGLE_Q1_CUISINE_PRIMARY_TYPES
    ? normalized as GoogleQ1CuisineId
    : null;
}

export function googlePrimaryTypesForQ1Cuisines(
  cuisines: readonly string[] | undefined,
): string[] {
  const selectedCuisineIds = [
    ...new Set(
      (cuisines ?? [])
        .map(normalizeCuisineId)
        .filter((cuisine): cuisine is GoogleQ1CuisineId => cuisine !== null),
    ),
  ];
  const cuisineIds = selectedCuisineIds.length > 0
    ? selectedCuisineIds
    : Object.keys(GOOGLE_Q1_CUISINE_PRIMARY_TYPES) as GoogleQ1CuisineId[];
  const primaryTypes = new Set<string>();

  for (const cuisine of cuisineIds) {
    for (const primaryType of GOOGLE_Q1_CUISINE_PRIMARY_TYPES[cuisine]) {
      if (primaryTypes.size >= GOOGLE_NEARBY_PRIMARY_TYPE_LIMIT) {
        return [...primaryTypes];
      }
      primaryTypes.add(primaryType);
    }
  }

  return [...primaryTypes];
}
