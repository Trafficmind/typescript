import type { TrafficmindClient } from "./client.js";

export class APIResource {
  protected readonly _client: TrafficmindClient;

  constructor(client: TrafficmindClient) {
    this._client = client;
  }
}

export function requireParam(name: string, value: string): void {
  if (!value || !value.trim()) {
    throw new TypeError(
      `[TrafficmindClient] "${name}" is required and must not be empty.`,
    );
  }
}

export function validateParam(
  name: string,
  value: string | number | undefined,
  constraints: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  },
): void {
  if (value === undefined) return;
  if (
    typeof value === "string" &&
    constraints.maxLength !== undefined &&
    value.length > constraints.maxLength
  ) {
    throw new TypeError(
      `[TrafficmindClient] "${name}" must be at most ${constraints.maxLength} characters long (got ${value.length}).`,
    );
  }
  if (
    typeof value === "string" &&
    constraints.minLength !== undefined &&
    value.length < constraints.minLength
  ) {
    throw new TypeError(
      `[TrafficmindClient] "${name}" must be at least ${constraints.minLength} characters long (got ${value.length}).`,
    );
  }
  if (
    typeof value === "number" &&
    constraints.max !== undefined &&
    value > constraints.max
  ) {
    throw new TypeError(
      `[TrafficmindClient] "${name}" must be at most ${constraints.max} (got ${value}).`,
    );
  }
  if (
    typeof value === "number" &&
    constraints.min !== undefined &&
    value < constraints.min
  ) {
    throw new TypeError(
      `[TrafficmindClient] "${name}" must be at least ${constraints.min} (got ${value}).`,
    );
  }
}
