-- Rebrand public site content from CROBIC / Champions Royal Bible College to CIBI.
-- Keeps lowercase technical paths such as /crobic-images untouched.
UPDATE "Setting"
SET "value" = replace(
  replace("value", 'Champions Royal Bible College', 'Champion International Bible Institute'),
  'CROBIC',
  'CIBI'
)
WHERE "value" LIKE '%Champions Royal Bible College%'
   OR "value" LIKE '%CROBIC%';
