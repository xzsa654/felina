import { existsSync } from "node:fs";
import { resolve as nodeResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LIB_ROOT = nodeResolve(import.meta.dirname, "..", "src", "lib");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("$lib/")) {
    const fsPath = nodeResolve(LIB_ROOT, specifier.slice("$lib/".length));
    const modulePath = existsSync(fsPath + ".ts")
      ? fsPath + ".ts"
      : nodeResolve(fsPath, "index.ts");
    const url = pathToFileURL(modulePath).href;
    return { url, shortCircuit: true };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    const parentPath = fileURLToPath(context.parentURL);
    const fsPath = nodeResolve(parentPath, "..", specifier);
    if (existsSync(fsPath + ".ts")) {
      return { url: pathToFileURL(fsPath + ".ts").href, shortCircuit: true };
    }
    if (existsSync(nodeResolve(fsPath, "index.ts"))) {
      return { url: pathToFileURL(nodeResolve(fsPath, "index.ts")).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
