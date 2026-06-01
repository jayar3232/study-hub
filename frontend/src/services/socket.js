// This module has been migrated to TypeScript. See `./socket.ts` for the implementation.
// This shim re-exports the TS module so existing `import { getSocket } from '.../services/socket'`
// callers continue to resolve via Vite's default `.js` extension resolution order.
export { getSocket, refreshSocketAuth, disconnectSocket } from './socket.ts';
