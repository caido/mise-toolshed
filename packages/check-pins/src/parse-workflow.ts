import { installSites } from "./shell-commands.js";
import type { EnvPair, ImageSite, ParsedFile, PinSite } from "./types.js";
import {
  foldBlock,
  indentOf,
  isBlockScalar,
  joinContinuations,
  parseYamlKey,
  readBlock,
  runHeader,
  splitYamlComment,
  structuralValue,
  unquoteYaml,
  yamlScalar,
} from "./yaml-scan.js";

type WorkflowRun = {
  readonly line: number;
  readonly command: string;
  readonly tool: "uv" | "pnpm";
  readonly job: number;
  readonly step: number;
  readonly scriptLocked: boolean;
  readonly commandLock: boolean | undefined;
  readonly honorMiseEnv: boolean;
};

export function parseWorkflow(relativePath: string, text: string): ParsedFile {
  const sites: PinSite[] = [];
  const lines = text.split(/\r?\n/);
  const workflowEnv = new Map<string, string>();
  const jobs: { env: Map<string, string> }[] = [];
  const steps: { env: Map<string, string> }[] = [];
  const runs: WorkflowRun[] = [];
  let currentJob = -1;
  let currentStep = -1;
  let jobIndent = -1;
  let jobsKeyIndent = -1;
  let expectingJob = false;
  let stepsIndent = -1;
  let stepDashIndent = -1;
  let envTarget: "workflow" | "job" | "step" | null = null;
  let envIndent = -1;
  let envContentIndent = -1;
  let imageIndent = -1;
  const runAnchors = new Map<string, readonly string[]>();

  const activeEnv = (): Map<string, string> => {
    if (envTarget === "step" && currentStep >= 0) return steps[currentStep]?.env ?? workflowEnv;
    if (envTarget === "job" && currentJob >= 0) return jobs[currentJob]?.env ?? workflowEnv;
    return workflowEnv;
  };

  const startJob = (): void => {
    currentJob = jobs.length;
    jobs.push({ env: new Map() });
    currentStep = -1;
    stepsIndent = -1;
    stepDashIndent = -1;
  };

  const takeCommand = (command: string, line: number): void => {
    for (const site of installSites(relativePath, line, command, [], false)) {
      runs.push({
        line: site.line,
        command: site.command,
        tool: site.tool,
        job: currentJob,
        step: currentStep,
        scriptLocked: site.scriptLocked,
        commandLock: site.commandLock,
        honorMiseEnv: site.honorMiseEnv,
      });
    }
  };

  const pushImage = (reference: string, lineNo: number, origin: ImageSite["origin"]): void => {
    sites.push({
      kind: "image",
      origin,
      reference,
      priorStageNames: [],
      path: relativePath,
      line: lineNo,
    });
  };

  const takeKey = (key: string, value: string, indent: number, lineNo: number, cursor: { i: number }): void => {
    const scalar = yamlScalar(value);
    const opened = structuralValue(scalar.value);
    if (key === "jobs" && opened === "" && currentJob < 0 && currentStep < 0) {
      expectingJob = true;
      jobsKeyIndent = indent;
      return;
    }
    if (key === "steps" && opened === "" && currentJob >= 0) {
      stepsIndent = indent;
      return;
    }
    if (key === "env" && opened === "" && !(imageIndent >= 0 && indent > imageIndent)) {
      envTarget = currentStep >= 0 ? "step" : currentJob >= 0 ? "job" : "workflow";
      envIndent = indent;
      envContentIndent = -1;
      return;
    }
    if (key === "uses") {
      const uses = unquoteYaml(scalar.value);
      if (uses.startsWith("docker://")) {
        pushImage(uses, lineNo, "docker-uses");
        return;
      }
      sites.push({ kind: "action", uses, comment: scalar.comment, path: relativePath, line: lineNo });
      return;
    }
    if ((key === "container" || key === "services") && currentJob >= 0 && currentStep < 0) {
      if (key === "container" && isBlockScalar(value)) {
        const physical = readBlock(lines, cursor, indent);
        const reference = (physical[0]?.text ?? "").trim();
        if (reference !== "") pushImage(reference, physical[0]?.line ?? lineNo, "workflow");
        return;
      }
      if (key === "container" && opened !== "" && !isBlockScalar(value)) {
        pushImage(unquoteYaml(opened), lineNo, "workflow");
        return;
      }
      if (opened === "") imageIndent = indent;
      return;
    }
    if (key === "image" && imageIndent >= 0 && indent > imageIndent) {
      pushImage(unquoteYaml(scalar.value), lineNo, "workflow");
      return;
    }
    if (key !== "run") return;
    const header = runHeader(scalar.value);
    if (header.alias !== undefined) {
      const aliased = runAnchors.get(header.alias);
      if (aliased === undefined) {
        sites.push({ kind: "unreadable", format: "workflow", path: relativePath, line: lineNo });
        return;
      }
      for (const script of aliased) takeCommand(script, lineNo);
      return;
    }
    if (header.block !== undefined) {
      const folded = header.block.startsWith(">");
      const physical = readBlock(lines, cursor, indent, true);
      if (folded) {
        const script = foldBlock(physical);
        if (header.anchor !== undefined) runAnchors.set(header.anchor, script.text === "" ? [] : [script.text]);
        if (script.text !== "") takeCommand(script.text, script.line);
        return;
      }
      const scripts = joinContinuations(physical);
      if (header.anchor !== undefined) runAnchors.set(header.anchor, scripts.map((script) => script.text));
      for (const script of scripts) takeCommand(script.text, script.line);
      return;
    }
    const plain = unquoteYaml(header.plain);
    if (header.anchor !== undefined) runAnchors.set(header.anchor, [plain]);
    takeCommand(plain, lineNo);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const indent = indentOf(line);
    if (imageIndent >= 0 && indent <= imageIndent) imageIndent = -1;
    if (envTarget !== null) {
      if (envContentIndent < 0) {
        if (indent > envIndent) envContentIndent = indent;
        else envTarget = null;
      }
      if (envTarget !== null && envContentIndent >= 0 && indent > envContentIndent) continue;
      if (envTarget !== null && envContentIndent >= 0 && indent === envContentIndent) {
        const kv = parseYamlKey(line);
        if (kv && kv.value.trim() !== "" && !isBlockScalar(kv.value)) {
          activeEnv().set(kv.key, unquoteYaml(splitYamlComment(kv.value).value));
        }
        continue;
      }
      if (envTarget !== null && indent <= envIndent) envTarget = null;
    }
    if (currentStep >= 0 && stepDashIndent >= 0 && indent <= stepDashIndent) currentStep = -1;
    if (currentJob >= 0 && jobIndent >= 0 && indent < jobIndent) {
      currentJob = -1;
      currentStep = -1;
      stepsIndent = -1;
      stepDashIndent = -1;
    }
    if (currentJob >= 0 && jobIndent >= 0 && indent === jobIndent) {
      currentStep = -1;
      stepsIndent = -1;
      stepDashIndent = -1;
    }
    const dash = /^(\s*)-\s*(.*)$/.exec(line);
    if (dash && stepsIndent >= 0 && indent >= stepsIndent) {
      currentStep = steps.length;
      steps.push({ env: new Map() });
      stepDashIndent = indent;
      const rest = dash[2] ?? "";
      if (rest.trim() !== "") {
        const kv = parseYamlKey(rest);
        if (kv) {
          const cursor = { i };
          takeKey(kv.key, kv.value, indent, i + 1, cursor);
          i = cursor.i;
        }
      }
      continue;
    }
    const kv = parseYamlKey(line);
    if (kv === undefined) continue;
    if (expectingJob && structuralValue(yamlScalar(kv.value).value) === "" && kv.indent > jobsKeyIndent) {
      expectingJob = false;
      jobIndent = kv.indent;
      startJob();
      continue;
    }
    if (jobIndent >= 0 && kv.indent === jobIndent && structuralValue(yamlScalar(kv.value).value) === "") {
      startJob();
      continue;
    }
    const cursor = { i };
    takeKey(kv.key, kv.value, kv.indent, i + 1, cursor);
    i = cursor.i;
  }

  for (const run of runs) {
    const map = new Map(workflowEnv);
    if (run.job >= 0) {
      for (const [name, value] of jobs[run.job]?.env ?? []) map.set(name, value);
    }
    if (run.step >= 0) {
      for (const [name, value] of steps[run.step]?.env ?? []) map.set(name, value);
    }
    const scopedEnv: EnvPair[] = [];
    for (const [name, value] of map) scopedEnv.push({ name, value });
    sites.push({
      kind: "install-command",
      tool: run.tool,
      command: run.command,
      scopedEnv,
      scriptLocked: run.scriptLocked,
      commandLock: run.commandLock,
      honorMiseEnv: run.honorMiseEnv,
      path: relativePath,
      line: run.line,
    });
  }
  return { sites, miseUvLocked: false, npmrcFrozen: false };
}
