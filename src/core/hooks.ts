export type RequestEvent = {
  type: "request";
  method: string;
  url: string;
  attempt: number;
};

export type ResponseEvent = {
  type: "response";
  method: string;
  url: string;
  attempt: number;
  status: number;
  durationMs: number;
};

export type ErrorEvent = {
  type: "error";
  method: string;
  url: string;
  attempt: number;
  durationMs: number;
  error: unknown;
};

export type HookEvent = RequestEvent | ResponseEvent | ErrorEvent;

export type RequestHook = (event: HookEvent) => void;
