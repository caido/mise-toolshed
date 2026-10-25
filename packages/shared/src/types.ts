export type PinSite =
  | DependencySite
  | ToolSite
  | PluginSite
  | ActionSite
  | ImageSite
  | InstallSite
  | UnreadableSite;

export type Site = { readonly path: string; readonly line: number };

export type DependencySite = Site & {
  readonly kind: "dependency";
  readonly family: "npm" | "package-manager" | "python";
  readonly name: string;
  readonly spec: string;
};

export type ToolSite = Site & {
  readonly kind: "tool";
  readonly name: string;
  readonly value: { readonly shape: "string"; readonly text: string };
};

export type PluginSite = Site & {
  readonly kind: "plugin";
  readonly name: string;
  readonly value: StringOrTable;
};

export type ActionSite = Site & {
  readonly kind: "action";
  readonly uses: string;
  readonly comment: string;
};

export type ImageSite = Site & {
  readonly kind: "image";
  readonly origin: "dockerfile" | "workflow" | "docker-uses";
  readonly reference: string;
  readonly priorStageNames: readonly string[];
};

export type InstallSite = Site & {
  readonly kind: "install-command";
  readonly tool: "uv" | "pnpm";
  readonly command: string;
  readonly scopedEnv: readonly EnvPair[];
  readonly scriptLocked: boolean;
  readonly commandLock: boolean | undefined;
  readonly honorMiseEnv: boolean;
};

export type UnreadableSite = Site & {
  readonly kind: "unreadable";
  readonly format: Exclude<FileKind, "skip">;
};

export type StringOrTable =
  | { readonly shape: "string"; readonly text: string }
  | { readonly shape: "table" };

export type EnvPair = { readonly name: string; readonly value: string };

export type Finding = {
  readonly path: string;
  readonly line: number;
  readonly message: string;
};

export type FileKind =
  | "package-json"
  | "pyproject"
  | "mise"
  | "dockerfile"
  | "workflow"
  | "npmrc"
  | "skip";

export type ParsedFile = {
  readonly sites: readonly PinSite[];
  readonly miseUvLocked: boolean;
  readonly npmrcFrozen: boolean;
};
