import type { PaginationMeta } from "../types.js";

export class Page<T> extends Array<T> {
  pagination?: PaginationMeta;

  constructor(items: T[] = []) {
    super(...items);
    Object.setPrototypeOf(this, Page.prototype);
  }
}

export function makePage<T>(
  items: T[] | undefined,
  pagination?: PaginationMeta,
): Page<T> {
  const page = new Page<T>(items ?? []);
  page.pagination = pagination;
  return page;
}
