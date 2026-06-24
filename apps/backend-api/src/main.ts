/**
 * backend-api bootstrap (stub).
 *
 * Step-10 implementation will boot a NestJS application here:
 *   - global zod validation pipe (schemas from @gostop/shared)
 *   - JWT auth (access + refresh, Redis-backed refresh rotation/blacklist)
 *   - Prisma module (soft-delete middleware + BaseModel timestamps)
 *   - modules: auth / member / ranking / admin
 *
 * Clean Architecture per module: interface -> application -> domain -> infrastructure.
 * This server is stateless and horizontally scalable behind the ALB.
 */
function main(): void {
  console.log('[backend-api] skeleton — NestJS bootstrap arrives in step 10');
}

main();
