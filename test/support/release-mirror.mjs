import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

function serve(root) {
  const directory = path.resolve(root);
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const relative = decodeURIComponent(requestUrl.pathname).replace(/^[/\\]+/, "");
    const file = path.resolve(directory, relative);
    if (file !== directory && !file.startsWith(`${directory}${path.sep}`)) {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      response.writeHead(200);
      response.end(readFileSync(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("release mirror has no port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

export function startMirror(directory) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), directory], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const line = stdout.split(/\r?\n/, 1)[0] ?? "";
      if (!settled && line.startsWith("http://")) {
        settled = true;
        resolve({
          url: line.trim(),
          async close() {
            if (child.exitCode !== null || child.signalCode !== null) return;
            child.kill();
            await new Promise((done) => {
              child.once("exit", () => done());
            });
          },
        });
      }
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`release mirror exited ${code ?? "none"}\n${stderr}`));
      }
    });
  });
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedAsCli()) {
  const root = process.argv[2];
  if (root === undefined || root === "") {
    process.stderr.write("usage: release-mirror.mjs <directory>\n");
    process.exit(1);
  }
  serve(root)
    .then((url) => {
      process.stdout.write(`${url}\n`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}
