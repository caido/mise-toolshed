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

test("CRLF line endings still reject a self-hosted runner", () => {
  const result = run("jobs:\r\n  job:\r\n    runs-on: self-hosted\r\n");
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
});

test("a trailing space or comment on jobs: still rejects a self-hosted runner", () => {
  const spaced = run("jobs: \n  job:\n    runs-on: self-hosted\n");
  assert.notEqual(spaced.error, null);
  assert.match(spaced.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
  const commented = run("jobs: # workflows\n  job:\n    runs-on: self-hosted\n");
  assert.notEqual(commented.error, null);
  assert.match(commented.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
});

test("a comment on the job header still rejects a self-hosted runner", () => {
  const result = run("jobs:\n  build: # compile\n    runs-on: self-hosted\n");
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
});

test("a workflow without jobs: fails", () => {
  const result = run("name: Validate\n");
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /scratch\.yml: jobs: is missing/);
});

test("a comment between jobs still rejects a later self-hosted runner", () => {
  const result = run(
    [
      "jobs:",
      "  first:",
      "    runs-on: ubuntu-latest",
      "# between jobs",
      "  second:",
      "    runs-on: self-hosted",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /scratch\.yml:6: runs-on must be ubuntu-latest/);
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
