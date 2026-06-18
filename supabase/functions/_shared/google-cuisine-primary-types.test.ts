import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  GOOGLE_NEARBY_PRIMARY_TYPE_LIMIT,
  googlePrimaryTypesForQ1Cuisines,
} from "./google-cuisine-primary-types.ts";

Deno.test("Google Q1 cuisine mapping returns specific primary types for selected cuisines", () => {
  assertEquals(googlePrimaryTypesForQ1Cuisines(["mexican", "thai"]), [
    "mexican_restaurant",
    "taco_restaurant",
    "tex_mex_restaurant",
    "burrito_restaurant",
    "thai_restaurant",
  ]);
});

Deno.test("Google Q1 cuisine mapping treats no preference as the bounded Q1 union", () => {
  const types = googlePrimaryTypesForQ1Cuisines(["noPreference"]);

  assert(types.length <= GOOGLE_NEARBY_PRIMARY_TYPE_LIMIT);
  assertEquals(types.includes("restaurant"), false);
  assertEquals(types.includes("mexican_restaurant"), true);
  assertEquals(types.includes("seafood_restaurant"), true);
});

Deno.test("Google Q1 cuisine mapping normalizes copy variants and dedupes overlap", () => {
  assertEquals(
    googlePrimaryTypesForQ1Cuisines([
      "Comfort Food",
      "comfort-food",
    ]),
    [
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
  );
});
