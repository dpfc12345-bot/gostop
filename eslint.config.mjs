// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Architectural dependency rules.
 *
 * Layering (a layer may only import from layers BELOW it):
 *
 *   apps/*            (backend-api, backend-game, web, admin)
 *      └── ai         (@gostop/ai)
 *            └── shared (@gostop/shared)
 *                  └── engine (@gostop/engine)   <-- bottom, depends on NOTHING
 *
 * The crown jewel is @gostop/engine: it MUST remain a pure, deterministic,
 * framework-agnostic library so it can run identically on the game server,
 * the web client, and a future mobile app (Flutter/React Native bridge).
 */

const FRAMEWORK_AND_IO = [
  '@nestjs/*',
  '@prisma/*',
  'prisma',
  'react',
  'react-dom',
  'react/*',
  'socket.io',
  'socket.io-client',
  'ioredis',
  'redis',
  'pg',
  'express',
  'fastify',
];

/** Build a no-restricted-imports rule from forbidden package groups. */
function forbid(groups) {
  return [
    'error',
    {
      patterns: groups.map(({ group, message }) => ({ group, message })),
    },
  ];
}

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/*.config.{js,mjs,cjs,ts}',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ── @gostop/engine: pure & standalone. No internal deps, no frameworks, no I/O.
  {
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': forbid([
        {
          group: ['@gostop/shared', '@gostop/shared/*', '@gostop/ai', '@gostop/ai/*'],
          message:
            'engine is the bottom layer and must not import other workspace packages.',
        },
        {
          group: FRAMEWORK_AND_IO,
          message:
            'engine must stay framework-agnostic and side-effect free (no NestJS/React/Socket.IO/DB/Redis).',
        },
      ]),
    },
  },

  // ── @gostop/shared: contracts/DTOs. May depend on engine only.
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': forbid([
        {
          group: ['@gostop/ai', '@gostop/ai/*'],
          message: 'shared must not depend on ai.',
        },
        {
          group: FRAMEWORK_AND_IO,
          message: 'shared holds transport-agnostic contracts; keep frameworks out.',
        },
      ]),
    },
  },

  // ── @gostop/ai: may depend on engine + shared. No frameworks/I/O.
  {
    files: ['packages/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': forbid([
        {
          group: FRAMEWORK_AND_IO,
          message: 'ai is a pure decision module; keep frameworks/I/O out.',
        },
      ]),
    },
  },

  // ── backend-api: REST/auth/members/ranking/admin. Must NOT run game logic.
  {
    files: ['apps/backend-api/**/*.ts'],
    rules: {
      'no-restricted-imports': forbid([
        {
          group: ['@gostop/engine', '@gostop/engine/*', '@gostop/ai', '@gostop/ai/*'],
          message:
            'backend-api does not execute games. Use @gostop/shared for types; game logic lives in backend-game.',
        },
      ]),
    },
  },

  // backend-game / web / admin: free to use engine + shared (+ ai for backend-game).
  {
    files: ['apps/backend-game/**/*.ts', 'apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
    rules: {},
  },

  // Test files: relax a few rules.
  {
    files: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
