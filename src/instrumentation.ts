/**
 * Server startup hook.
 *
 * `register` runs exactly once per server instance and must finish before the
 * first request is served, which makes it the right place to validate
 * configuration: a misconfigured server fails immediately and loudly, rather
 * than serving errors to whoever happens to load a page first.
 *
 * Note this is deliberately NOT done in `next.config.ts`. Configuration is a
 * property of the RUNTIME environment, not of the build. The production image is
 * built in CI, where the production database password rightly does not exist, so
 * validating at build time would either fail the build or force us to feed CI
 * fake secrets.
 *
 * This file is compiled for BOTH the Node.js and Edge runtimes, so it must stay
 * free of Node-specific APIs. A runtime check alone is not enough - Next.js
 * analyses the file statically and will warn about Node APIs even inside a branch
 * that can never execute on the Edge. All real work therefore lives in
 * ./instrumentation.node, which is only ever imported on the Node.js runtime.
 */
import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { registerNodeServer } = await import('./instrumentation.node');
  registerNodeServer();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportRequestError } = await import('./instrumentation.node');
  // Awaited because the hook's type permits a Promise; today it is synchronous.
  await reportRequestError(error, request, context);
};
