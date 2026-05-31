import { resolve as nodeResolve } from "node:path";
import { pathToFileURL } from "node:url";

const LIB_ROOT = nodeResolve(import.meta.dirname, "..", "src", "lib");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("$lib/")) {
    const fsPath = nodeResolve(LIB_ROOT, specifier.slice("$lib/".length));
    const url = pathToFileURL(fsPath + ".ts").href;
    return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
