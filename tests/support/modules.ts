import { History } from "@/core/history";
import { createToolHost, type DocumentToolHost } from "@/editor/canvas/toolHost/createToolHost";
import type { ModuleContext } from "@/editor/module";
import { makeDocument } from "@test/factories";

/**
 * A `ModuleContext` over one document, as the shell builds it: `dispatch` records into `history`,
 * `forTool` goes through that document's tool host, and the app actions do nothing.
 */
export function moduleContext(
  overrides: Partial<ModuleContext> & { host?: DocumentToolHost } = {},
): ModuleContext {
  const { host: givenHost, ...rest } = overrides;
  const doc = rest.doc ?? makeDocument();
  const history = rest.history ?? new History();
  let host = givenHost;
  return {
    doc,
    history,
    dispatch: (factory) => {
      const command = factory();
      if (command) history.push(command);
      return command !== null;
    },
    navigate: () => {},
    showHelp: () => {},
    save: () => Promise.resolve(),
    forTool: (toolId) => (host ??= createToolHost({ doc, history })).forTool(toolId),
    ...rest,
  };
}
