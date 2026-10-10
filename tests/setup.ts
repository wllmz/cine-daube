import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without Vitest globals, Testing Library cannot register its own cleanup:
// unmount rendered components between tests so they don't leak into the next.
afterEach(() => {
  cleanup();
});
