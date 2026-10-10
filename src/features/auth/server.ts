import "server-only";

// Server-only public API, kept apart from index.ts so client bundles never import it.
export { getCurrentUser } from "./services/current-user";
