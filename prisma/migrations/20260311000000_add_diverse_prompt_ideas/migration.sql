-- Add more diverse prompt ideas with richer scenes, multi-character actions, and varied environments
-- These work with the new multi-template prompt system for greater variety

INSERT INTO "PromptIdea" ("id", "animal", "action", "scene", "props", "used", "createdAt")
VALUES
  -- Shopping / market scenes
  (gen_random_uuid(), 'bear', 'browsing shelves and picking out ingredients', 'corner grocery store', 'stacked cans, a shopping basket, produce displays, and hanging price tags', false, NOW()),
  (gen_random_uuid(), 'cat', 'arranging bouquets and wrapping flowers', 'flower market stall', 'buckets of roses, ribbon rolls, wrapping paper, a watering can, and a cash register', false, NOW()),

  -- Craft / maker scenes
  (gen_random_uuid(), 'raccoon', 'sewing a patchwork quilt with a needle and thread', 'craft room', 'fabric scraps, a sewing machine, spools of thread, scissors, and pin cushions', false, NOW()),
  (gen_random_uuid(), 'hedgehog', 'glazing pottery on a spinning wheel', 'ceramics studio', 'clay pots, paintbrushes, glaze bottles, a kiln, and drying racks of bowls', false, NOW()),

  -- Kitchen / food scenes
  (gen_random_uuid(), 'penguin', 'rolling out dough and cutting cookie shapes', 'holiday kitchen', 'cookie cutters, a rolling pin, sprinkles, an oven with cookies inside, and a frosting bag', false, NOW()),
  (gen_random_uuid(), 'fox', 'stirring a big pot of soup while tasting with a spoon', 'country kitchen', 'a bubbling pot, chopped vegetables, a recipe book, hanging ladles, and herb bundles', false, NOW()),

  -- Cozy indoor scenes
  (gen_random_uuid(), 'mouse', 'building a blanket fort with fairy lights', 'living room', 'draped blankets, string lights, pillows, stuffed animals, and a plate of cookies', false, NOW()),
  (gen_random_uuid(), 'otter', 'organizing books by color on tall shelves', 'cozy bookshop', 'towering bookshelves, a rolling ladder, stacked books, a reading nook, and a shop cat', false, NOW()),

  -- Outdoor adventure scenes
  (gen_random_uuid(), 'deer', 'paddling a canoe down a gentle stream', 'autumn forest river', 'a wooden canoe, fallen leaves, overhanging branches, a fishing rod, and a packed lunch', false, NOW()),
  (gen_random_uuid(), 'bunny', 'flying a kite on a breezy hilltop', 'rolling countryside hills', 'a diamond kite, wildflowers, a picnic blanket, a thermos, and fluffy clouds', false, NOW()),

  -- Nighttime / magical scenes
  (gen_random_uuid(), 'owl', 'reading by lantern light in a hollow tree', 'enchanted nighttime forest', 'a glowing lantern, stacked books, fireflies, mushrooms, and a crescent moon', false, NOW()),
  (gen_random_uuid(), 'cat', 'stargazing through a rooftop telescope', 'city rooftop at night', 'a telescope, a star chart, a blanket, a thermos of cocoa, and twinkling city lights below', false, NOW()),

  -- Work / profession scenes
  (gen_random_uuid(), 'hamster', 'sorting letters and stamping packages at a tiny counter', 'village post office', 'stacked parcels, letter slots, stamps, a scale, and postcard displays', false, NOW()),
  (gen_random_uuid(), 'turtle', 'mixing colors and painting a mural on a wall', 'street art alley', 'paint buckets, a step ladder, spray cans, a boombox, and drying paintings', false, NOW()),

  -- Seasonal / holiday scenes
  (gen_random_uuid(), 'panda', 'hanging lanterns and paper decorations from strings', 'festival courtyard', 'paper lanterns, bunting flags, a food cart, drums, and confetti', false, NOW()),
  (gen_random_uuid(), 'squirrel', 'decorating a gingerbread house with icing and candy', 'winter cabin kitchen', 'a gingerbread house, icing bags, gumdrops, candy canes, and powdered sugar', false, NOW()),

  -- Transportation / travel scenes
  (gen_random_uuid(), 'koala', 'driving a little bus packed with luggage on the roof', 'winding mountain road', 'a cute bus, suitcases, a map, road signs, and mountain scenery', false, NOW()),
  (gen_random_uuid(), 'seal', 'sailing a small boat with patchwork sails', 'calm harbor', 'a sailboat, buoys, seagulls, a lighthouse, fishing nets, and a dock', false, NOW()),

  -- Garden / nature scenes
  (gen_random_uuid(), 'frog', 'tending a rooftop garden with rows of vegetables', 'urban rooftop garden', 'planter boxes, tomato vines, a watering can, garden gloves, and a city skyline', false, NOW()),
  (gen_random_uuid(), 'lamb', 'picking wildflowers in a meadow with butterflies', 'sunlit flower meadow', 'daisies, sunflowers, a woven basket, butterflies, bees, and a wooden fence', false, NOW()),

  -- Bathtime / self-care scenes
  (gen_random_uuid(), 'hippo', 'soaking in a claw-foot bathtub surrounded by bubbles', 'vintage bathroom', 'rubber ducks, bubble mountains, bath bombs, candles, fluffy towels, and a bath tray with a book', false, NOW()),
  (gen_random_uuid(), 'sloth', 'getting a relaxing spa facial with cucumber slices', 'tropical spa room', 'face masks, cucumber slices, bamboo towels, essential oil bottles, and tropical plants', false, NOW()),

  -- Music / performance scenes
  (gen_random_uuid(), 'dog', 'playing drums in a garage band setup', 'music garage', 'a drum kit, electric guitars, amplifiers, music sheets, and band posters on the walls', false, NOW()),
  (gen_random_uuid(), 'pig', 'conducting a tiny orchestra of animal friends', 'concert hall stage', 'music stands, violins, a grand piano, a conductor baton, and velvet curtains', false, NOW()),

  -- Science / discovery scenes
  (gen_random_uuid(), 'elephant', 'peering through a microscope in a cluttered lab', 'science laboratory', 'beakers, test tubes, a microscope, plant specimens, charts on the wall, and safety goggles', false, NOW()),
  (gen_random_uuid(), 'red panda', 'building a model rocket at a messy workbench', 'inventor workshop', 'a rocket model, wrenches, blueprints, nuts and bolts, a toolbox, and safety goggles', false, NOW()),

  -- Cafe / restaurant scenes
  (gen_random_uuid(), 'duck', 'serving tea and pastries from behind a cafe counter', 'cozy corner cafe', 'a coffee machine, tiered cake stands, teacups, a chalkboard menu, and hanging plants', false, NOW()),
  (gen_random_uuid(), 'giraffe', 'making bubble tea with colorful toppings', 'bubble tea shop', 'boba cups, tapioca pearls in jars, a blender, flavor syrups, and a neon sign', false, NOW()),

  -- Laundry / chores scenes (charming mundane activities)
  (gen_random_uuid(), 'sheep', 'hanging freshly washed clothes on a line to dry', 'sunny backyard', 'a clothesline, clothespins, a laundry basket, sheets blowing in the wind, and a birdbath', false, NOW()),
  (gen_random_uuid(), 'lion cub', 'washing dishes in a sink full of bubbles', 'cluttered kitchen', 'stacked dishes, soap bubbles, a dish rack, sponges, and a window with plants on the sill', false, NOW())

ON CONFLICT DO NOTHING;
