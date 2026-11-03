export function startMirror(directory: string): Promise<{
  url: string;
  close(): Promise<void>;
}>;
