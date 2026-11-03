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
  assert.match(
    result.stderr,
    /scratch\.yml:3: runs-on must be ubuntu-latest or macos-latest or windows-latest/,
  );
});

test("a space before the runs-on colon accepts ubuntu-latest", () => {
  const quoted = run('jobs:\n  job:\n    runs-on : "ubuntu-latest"\n');
  assert.equal(quoted.error, null);
  const plain = run("jobs:\n  job:\n    runs-on: ubuntu-latest\n");
  assert.equal(plain.error, null);
});

test("windows-latest is a GitHub-hosted runner", () => {
  const result = run("jobs:\n  job:\n    runs-on: windows-latest\n");
  assert.equal(result.error, null);
  assert.equal(result.stderr, "");
});

test("macos-latest is a GitHub-hosted runner", () => {
  const result = run("jobs:\n  job:\n    runs-on: macos-latest\n");
  assert.equal(result.error, null);
  assert.equal(result.stderr, "");
});

test("a matrix of GitHub-hosted runners is accepted", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "        os: [windows-latest, macos-latest, ubuntu-latest]",
    ].join("\n"),
  );
  assert.equal(result.error, null, result.stderr);
});

test("a matrix that includes a self-hosted runner is rejected", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "        os:",
      "          - ubuntu-latest",
      "          - self-hosted",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});
