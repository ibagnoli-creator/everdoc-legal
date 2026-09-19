#!/usr/bin/env node
// Erzeugt aus questions.de.json eine Migration.
//
// Absicht: die Fragen liegen als prüfbares JSON im Repo (dort lässt sich ein
// Tippfehler im Review sehen), die Datenbank bekommt daraus generiertes SQL.
//
//   node seed/to-sql.mjs > supabase/migrations/0003_seed_questions_de.sql

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, "questions.de.json"), "utf8"));

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const array = (values) => `array[${values.map(quote).join(", ")}]`;

const lines = [
  "-- Generiert von seed/to-sql.mjs – nicht von Hand bearbeiten.",
  `-- Quelle: seed/questions.de.json (${seed.questions.length} Fragen)`,
  "",
];

for (const category of seed.categories) {
  lines.push(
    "insert into categories (slug, label_de, label_en) values " +
      `(${quote(category.slug)}, ${quote(category.label_de)}, ${quote(category.label_en)}) ` +
      "on conflict (slug) do nothing;",
  );
}

lines.push("", "insert into questions (category_id, locale, text, options, correct_index, status)");

const values = seed.questions.map((question) => {
  if (question.options.length !== 4) {
    throw new Error(`Frage braucht genau vier Optionen: ${question.text}`);
  }
  if (!Number.isInteger(question.correct_index) ||
      question.correct_index < 0 || question.correct_index > 3) {
    throw new Error(`correct_index ausserhalb 0–3: ${question.text}`);
  }
  return "  select id, " + quote(seed.locale) + ", " + quote(question.text) + ", " +
    array(question.options) + ", " + question.correct_index + ", 'live'" +
    " from categories where slug = " + quote(question.category);
});

lines.push(values.join("\n  union all\n") + ";");
lines.push("");

process.stdout.write(lines.join("\n"));
