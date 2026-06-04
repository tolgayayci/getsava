import { z } from '@hono/zod-openapi';

/** Shared error body. Registered once as the OpenAPI `Error` component. */
export const ErrorSchema = z.object({ error: z.string(), message: z.string() }).openapi('Error');

export const jsonError = { 'application/json': { schema: ErrorSchema } } as const;
