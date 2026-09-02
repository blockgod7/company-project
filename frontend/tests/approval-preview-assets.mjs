import { registerHooks } from "node:module";

// Node tests need only the asset URL; Vite serves the actual image in the app.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".png")) return { format: "module", source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    return nextLoad(url, context);
  }
});
