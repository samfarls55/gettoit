// GetToIt web — vitest setup.
// Pulls in jest-dom matchers so component tests can assert on DOM
// shape; wires `cleanup()` after each test so rendered React trees
// don't bleed across tests (vitest doesn't enable auto-cleanup like
// jest does by default).

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
