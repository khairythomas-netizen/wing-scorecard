// setup.sql is the file people paste into the Supabase SQL editor. It is just
// schema.sql and auth.sql glued together, and gluing it by hand is how the
// three drifted apart before. Run `npm run sql` after editing either source.
import { readFile, writeFile } from 'node:fs/promises';

const HEADER = `-- =====================================================================
-- WingZ — complete database setup
--
-- Paste this ENTIRE file into the Supabase SQL Editor and run it.
-- IMPORTANT: clear the editor first, or leftovers from a previous paste
-- will fail before this file is reached.
-- Safe to run repeatedly: every statement is guarded.
-- =====================================================================


`;

const DIVIDER = `

-- =====================================================================
-- PART 2: auth, storage and write-side RPCs
-- =====================================================================

`;

const [schema, auth] = await Promise.all([
  readFile('supabase/schema.sql', 'utf8'),
  readFile('supabase/auth.sql', 'utf8'),
]);

await writeFile('supabase/setup.sql', HEADER + schema + DIVIDER + auth);
console.log('supabase/setup.sql rebuilt');
