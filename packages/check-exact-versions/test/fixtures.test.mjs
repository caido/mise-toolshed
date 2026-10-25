import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerFixtures } from "../../shared/test-support/register-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const bundle = path.join(packageRoot, "dist", `${pkg.name}.mjs`);
const cases = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8"));

registerFixtures([bundle], cases);
