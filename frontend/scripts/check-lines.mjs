// Validates frontend/src/story/lines.json against types.ts. Usage: node frontend/scripts/check-lines.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const linesPath = process.argv[2] ?? join(here, "../src/story/lines.json");
const typesPath = process.argv[3] ?? join(here, "../src/story/types.ts");
const lines = JSON.parse(readFileSync(linesPath, "utf8"));
const types = readFileSync(typesPath, "utf8");

const union = (name) => {
  const m = types.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
  return new Set([...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]));
};
const sides = union("Side"), roles = union("Role"), moods = union("Mood"), sits = union("Situation");
const errors = [];
const ids = new Set();

for (const l of lines) {
  if (ids.has(l.id)) errors.push(`duplicate id ${l.id}`);
  ids.add(l.id);
  if (l.side !== "any" && !sides.has(l.side)) errors.push(`${l.id}: bad side ${l.side}`);
  if (l.role !== "any" && !roles.has(l.role)) errors.push(`${l.id}: bad role ${l.role}`);
  if (!sits.has(l.situation)) errors.push(`${l.id}: bad situation ${l.situation}`);
  if (!moods.has(l.mood)) errors.push(`${l.id}: bad mood ${l.mood}`);
  if (l.text.length > 60) errors.push(`${l.id}: text over 60 chars (${l.text.length})`);
  if (l.conditions?.targetRole && !roles.has(l.conditions.targetRole)) errors.push(`${l.id}: bad targetRole`);
}

// Every role/side needs its fallback, and the most common situations must be covered.
const count = (side, role, sit) => lines.filter((l) => l.side === side && l.role === role && l.situation === sit).length;
for (const side of sides) {
  if (!count(side, "any", "any")) errors.push(`${side}: no side-generic fallback`);
  for (const role of roles) {
    if (count(side, role, "any") < 2) errors.push(`${side}.${role}: fewer than 2 'any' fallback lines`);
    if (count(side, role, "capture") < 1) errors.push(`${side}.${role}: no capture line`);
    if (count(side, role, "quiet") < 1) errors.push(`${side}.${role}: no quiet line`);
    if (role !== "lord" && count(side, role, "fallen") < 1) errors.push(`${side}.${role}: no fallen line`);
    if (role !== "lord" && count(side, role, "check") < 1) errors.push(`${side}.${role}: no check line`);
  }
  for (const s of ["game_start", "checked", "mated", "victory", "defeat", "draw", "king_danger"])
    if (!count(side, "lord", s)) errors.push(`${side}.lord: no ${s} line`);
}

console.log(`${lines.length} lines checked`);
if (errors.length) { console.log(errors.join("\n")); process.exit(1); }
console.log("OK");
