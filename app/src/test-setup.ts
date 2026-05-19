import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom's URL.createObjectURL doesn't actually work with Blobs — always
// replace it for blob URL tests.
let urlCounter = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).createObjectURL = () => `blob:test/${++urlCounter}`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(URL as any).revokeObjectURL = () => {};

afterEach(() => {
  cleanup();
  localStorage.clear();
});
