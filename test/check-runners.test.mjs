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

test("an anchored job header still rejects a self-hosted runner", () => {
  const anchor = run("jobs:\n  build: &base_job\n    runs-on: self-hosted\n");
  assert.notEqual(anchor.error, null);
  assert.match(anchor.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
  const commented = run("jobs:\n  build: &base_job # shared\n    runs-on: self-hosted\n");
  assert.notEqual(commented.error, null);
  assert.match(commented.stderr, /scratch\.yml:3: runs-on must be ubuntu-latest/);
  const allowed = run("jobs:\n  build: &base_job\n    runs-on: ubuntu-latest\n");
  assert.equal(allowed.error, null, allowed.stderr);
});

test("a flow-mapping job still rejects a self-hosted runner", () => {
  const result = run("jobs:\n  build: { runs-on: self-hosted }\n");
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a matrix key indented by four spaces is still read", () => {
  const allowed = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "          os: [ubuntu-latest]",
    ].join("\n"),
  );
  assert.equal(allowed.error, null, allowed.stderr);
  const rejected = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "          os: [self-hosted]",
    ].join("\n"),
  );
  assert.notEqual(rejected.error, null);
  assert.match(rejected.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a strategy inside a run script does not hide a self-hosted matrix", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    steps:",
      "      - run: |",
      "          strategy:",
      "            matrix:",
      "              os: [ubuntu-latest]",
      "    strategy:",
      "      matrix:",
      "        os: [self-hosted]",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a strategy inside with does not hide a self-hosted matrix", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    steps:",
      "      - uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
      "        with:",
      "          strategy:",
      "            matrix:",
      "              os: [ubuntu-latest]",
      "    strategy:",
      "      matrix:",
      "        os: [self-hosted]",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a quoted runs-on key still rejects a self-hosted runner", () => {
  const result = run('jobs:\n  job:\n    "runs-on": self-hosted\n');
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a complex runs-on key still rejects a self-hosted runner", () => {
  const result = run("jobs:\n  job:\n    ? runs-on\n    : self-hosted\n");
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a quoted include key is rejected", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu-latest]",
      '        "include":',
      "          - os: self-hosted",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a duplicate quoted os key is rejected", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu-latest]",
      '        "os": [self-hosted]',
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /Map keys must be unique/);
});

test("an os key under env does not select the runner", () => {
  const hidden = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    env:",
      "      os: ubuntu-latest",
      "    strategy:",
      "      matrix:",
      "        os: [self-hosted]",
    ].join("\n"),
  );
  assert.notEqual(hidden.error, null);
  assert.match(hidden.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
  const ignored = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    env:",
      "      os: self-hosted",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu-latest]",
    ].join("\n"),
  );
  assert.equal(ignored.error, null, ignored.stderr);
});

test("a matrix include is rejected", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu-latest]",
      "        include:",
      "          - os: self-hosted",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
});

test("a matrix exclude is rejected", () => {
  const result = run(
    [
      "jobs:",
      "  job:",
      "    runs-on: ${{ matrix.os }}",
      "    strategy:",
      "      matrix:",
      "        os: [ubuntu-latest, macos-latest]",
      "        exclude:",
      "          - os: macos-latest",
    ].join("\n"),
  );
  assert.notEqual(result.error, null);
  assert.match(result.stderr, /runs-on must be ubuntu-latest or macos-latest or windows-latest/);
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
