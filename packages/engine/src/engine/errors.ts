export type EngineErrorCode = 'ILLEGAL_ACTION' | 'ILLEGAL_STATE' | 'UNSUPPORTED_ACTION';

/** Thrown when an action is not legal in the current state (server-authoritative guard). */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}
