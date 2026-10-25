import assert from "node:assert/strict";
import test from "node:test";
import { checkWorkflows } from "../scripts/check-runners.mjs";

function run(text) {
  let stdout = "";
  let stderr = "";
  const io = {
    stdout: {
      write(chunk) {
        stdout += chunk;
      },
    },
    stderr: {
      write(chunk) {
        stderr += chunk;
      },
    },
  };
  let error = null;
  try {
    checkWorkflows([{ path: ".github/workflows/scratch.yml", text }], io);
  } catch (caught) {
    error = caught;
  }
  return { stdout, stderr, error };
}

test("a space before the runs-on colon still rejects a foreign runner", () => {
  const result = run("jobs:\n  job:\n    runs-on : self-hosted\n");
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
});

test("a space before the runs-on colon accepts ubuntu-latest", () => {
  const quoted = run('jobs:\n  job:\n    runs-on : "ubuntu-latest"\n');
  assert.equal(quoted.error, null);
  const plain = run("jobs:\n  job:\n    runs-on: ubuntu-latest\n");
  assert.equal(plain.error, null);
});
