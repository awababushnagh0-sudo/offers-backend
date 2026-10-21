-- A category labels one store ("مقهى", not "مقاهي") in the customer and
-- business apps, so names and slugs are singular.
UPDATE "categories" SET "slug" = 'sweet', "name_ar" = 'حلويات', "name_en" = 'Sweets' WHERE "slug" = 'sweets';
UPDATE "categories" SET "slug" = 'cafe', "name_ar" = 'مقهى', "name_en" = 'Café' WHERE "slug" = 'cafes';
UPDATE "categories" SET "slug" = 'bakery', "name_ar" = 'مخبز', "name_en" = 'Bakery' WHERE "slug" = 'bakeries';
