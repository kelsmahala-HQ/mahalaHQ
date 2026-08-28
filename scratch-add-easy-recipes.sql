-- Adds 6 easy, varied recipes to your Recipe Box (different from grilled-cheese-level basics,
-- but still simple: minimal ingredients, short steps). Assumes you have one household -- if you
-- ever have more than one, edit the v_household_id line below to point at the right one.
-- Safe to run once; running it twice will just add the recipes again (no "if not exists" guard,
-- since recipe names aren't unique in this app).

do $$
declare
  v_household_id uuid := (select id from households order by created_at limit 1);
  v_id uuid;
begin

  -- 1. Sheet Pan Sausage & Peppers (dinner)
  insert into recipes (household_id, name, servings, category, instructions)
  values (v_household_id, 'Sheet Pan Sausage & Peppers', 4, 'dinner',
    '1. Preheat oven to 425°F.
2. Toss sausage, peppers, and onion with olive oil, garlic powder, paprika, salt, and pepper on a sheet pan.
3. Spread in a single layer.
4. Bake 20-25 minutes, stirring once halfway, until veggies are tender and sausage is browned.')
  returning id into v_id;
  insert into recipe_ingredients (household_id, recipe_id, name, quantity, position) values
    (v_household_id, v_id, 'smoked sausage, sliced', '1 lb', 0),
    (v_household_id, v_id, 'red bell pepper, sliced', '1', 1),
    (v_household_id, v_id, 'green bell pepper, sliced', '1', 2),
    (v_household_id, v_id, 'yellow onion, sliced', '1', 3),
    (v_household_id, v_id, 'olive oil', '2 tbsp', 4),
    (v_household_id, v_id, 'garlic powder', '1 tsp', 5),
    (v_household_id, v_id, 'paprika', '1 tsp', 6),
    (v_household_id, v_id, 'salt and pepper', 'to taste', 7);

  -- 2. Taco Rice Bowls (dinner)
  insert into recipes (household_id, name, servings, category, instructions)
  values (v_household_id, 'Taco Rice Bowls', 4, 'dinner',
    '1. Brown ground beef in a skillet over medium heat, breaking it up as it cooks.
2. Drain excess grease, then stir in taco seasoning and 1/2 cup water. Simmer 5 minutes.
3. Divide rice into bowls.
4. Top with taco meat, cheese, lettuce, and salsa.
5. Serve with sour cream.')
  returning id into v_id;
  insert into recipe_ingredients (household_id, recipe_id, name, quantity, position) values
    (v_household_id, v_id, 'ground beef', '1 lb', 0),
    (v_household_id, v_id, 'taco seasoning', '1 packet', 1),
    (v_household_id, v_id, 'cooked rice', '2 cups', 2),
    (v_household_id, v_id, 'shredded cheddar cheese', '1 cup', 3),
    (v_household_id, v_id, 'shredded lettuce', '1 cup', 4),
    (v_household_id, v_id, 'salsa', '1/2 cup', 5),
    (v_household_id, v_id, 'sour cream, for serving', null, 6);

  -- 3. 15-Minute Garlic Butter Pasta (dinner)
  insert into recipes (household_id, name, servings, category, instructions)
  values (v_household_id, '15-Minute Garlic Butter Pasta', 4, 'dinner',
    '1. Cook spaghetti according to package directions; reserve 1/2 cup pasta water before draining.
2. Melt butter in a large skillet over medium heat. Add garlic and cook 1 minute until fragrant.
3. Add drained pasta to the skillet along with parmesan and a splash of pasta water. Toss to coat.
4. Season with salt and pepper, top with parsley if using.')
  returning id into v_id;
  insert into recipe_ingredients (household_id, recipe_id, name, quantity, position) values
    (v_household_id, v_id, 'spaghetti', '1 lb', 0),
    (v_household_id, v_id, 'butter', '4 tbsp', 1),
    (v_household_id, v_id, 'garlic, minced', '4 cloves', 2),
    (v_household_id, v_id, 'grated parmesan', '1/2 cup', 3),
    (v_household_id, v_id, 'salt and pepper', 'to taste', 4),
    (v_household_id, v_id, 'fresh parsley (optional)', null, 5);

  -- 4. Breakfast Burritos (breakfast)
  insert into recipes (household_id, name, servings, category, instructions)
  values (v_household_id, 'Breakfast Burritos', 4, 'breakfast',
    '1. Whisk eggs with milk, salt, and pepper.
2. Scramble eggs in a skillet over medium heat until just set.
3. Warm tortillas.
4. Fill each tortilla with scrambled eggs, cheese, and sausage/bacon if using.
5. Roll up burrito-style and serve.')
  returning id into v_id;
  insert into recipe_ingredients (household_id, recipe_id, name, quantity, position) values
    (v_household_id, v_id, 'eggs', '6', 0),
    (v_household_id, v_id, 'milk', '1/4 cup', 1),
    (v_household_id, v_id, 'shredded cheese', '1 cup', 2),
    (v_household_id, v_id, 'large flour tortillas', '4', 3),
    (v_household_id, v_id, 'salt and pepper', 'to taste', 4),
    (v_household_id, v_id, 'cooked breakfast sausage or bacon (optional)', null, 5);

  -- 5. Caprese Sandwich (lunch)
  insert into recipes (household_id, name, servings, category, instructions)
  values (v_household_id, 'Caprese Sandwich', 2, 'lunch',
    '1. Lightly toast the bread if desired.
2. Layer tomato, mozzarella, and basil on two slices of bread.
3. Drizzle with olive oil and balsamic glaze; season with salt and pepper.
4. Top with remaining bread slices and serve.')
  returning id into v_id;
  insert into recipe_ingredients (household_id, recipe_id, name, quantity, position) values
    (v_household_id, v_id, 'crusty bread', '4 slices', 0),
    (v_household_id, v_id, 'tomato, sliced', '1 large', 1),
    (v_household_id, v_id, 'fresh mozzarella, sliced', '8 oz', 2),
    (v_household_id, v_id, 'fresh basil leaves', null, 3),
    (v_household_id, v_id, 'balsamic glaze', '2 tbsp', 4),
    (v_household_id, v_id, 'olive oil', null, 5),
    (v_household_id, v_id, 'salt and pepper', 'to taste', 6);

  -- 6. Loaded Baked Potatoes (side)
  insert into recipes (household_id, name, servings, category, instructions)
  values (v_household_id, 'Loaded Baked Potatoes', 4, 'side',
    '1. Preheat oven to 400°F.
2. Rub potatoes with olive oil and pierce a few times with a fork.
3. Bake 45-60 minutes until fork-tender (or microwave 10-12 minutes for a shortcut).
4. Slice open, fluff the inside, and top with cheese, bacon, sour cream, and chives.')
  returning id into v_id;
  insert into recipe_ingredients (household_id, recipe_id, name, quantity, position) values
    (v_household_id, v_id, 'russet potatoes', '4', 0),
    (v_household_id, v_id, 'olive oil', '2 tbsp', 1),
    (v_household_id, v_id, 'shredded cheddar cheese', '1 cup', 2),
    (v_household_id, v_id, 'cooked bacon bits', '1/2 cup', 3),
    (v_household_id, v_id, 'sour cream', '1/2 cup', 4),
    (v_household_id, v_id, 'chopped chives', '2 tbsp', 5),
    (v_household_id, v_id, 'salt and pepper', 'to taste', 6);

end $$;
