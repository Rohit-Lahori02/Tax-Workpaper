/**
 * The packet's reference formats (see readme.reference_formats) parsed into a
 * typed shape, plus the single place that decides where a reference links to.
 */

export type Ref =
  | { kind: "value"; id: string }
  | { kind: "document"; id: string; page?: number }
  | { kind: "line"; key: string }
  | { kind: "version"; id: string }
  | { kind: "questionnaire"; id: string }
  | { kind: "message"; id: string }
  | { kind: "call"; id: string }
  | { kind: "staff"; id: string }
  | { kind: "client_user"; id: string }
  | { kind: "person"; id: string }
  | { kind: "asset"; id: string }
  | { kind: "timeline"; id: string }
  | { kind: "notice"; id: string }
  | { kind: "prior_year"; pointer: string }
  | { kind: "agency"; pointer: string }
  | { kind: "engine_param"; path: string }
  | { kind: "unknown"; raw: string };

export type RefKind = Ref["kind"];

// Form codes listed in readme.form_codes, plus prior-year keys such as CA540.13 and F8938.
const LINE_KEY = /^(F\d{3,4}[A-Z]?(?:-[A-Z])?|Sch[A-Za-z0-9]+|ScheduleS|FTB\d{4}[A-Z]?|CA540)(?:\.|$)/;

export function parseRef(raw: string): Ref {
  const s = raw.trim();
  let m: RegExpExecArray | null;
  if (/^ev-\d+$/.test(s)) return { kind: "value", id: s };
  if (/^D\d+$/.test(s)) return { kind: "document", id: s };
  if ((m = /^doc:(D\d+)#page(\d+)$/.exec(s))) return { kind: "document", id: m[1], page: Number(m[2]) };
  if (/^v\d+$/.test(s)) return { kind: "version", id: s };
  if (/^qa-\d+$/.test(s)) return { kind: "questionnaire", id: s };
  if (/^msg-\d+$/.test(s)) return { kind: "message", id: s };
  if (/^call-\d+$/.test(s)) return { kind: "call", id: s };
  if (/^st-\d+$/.test(s)) return { kind: "staff", id: s };
  if (/^cu-\d+$/.test(s)) return { kind: "client_user", id: s };
  if ((m = /^household:(.+)$/.exec(s))) return { kind: "person", id: m[1] };
  if ((m = /^asset:(.+)$/.exec(s))) return { kind: "asset", id: m[1] };
  if ((m = /^timeline:(.+)$/.exec(s))) return { kind: "timeline", id: m[1] };
  if (/^tl-\d+$/.test(s) || /^extension-\d{4}-\d{2}-\d{2}$/.test(s)) return { kind: "timeline", id: s };
  if (/^N-\d{4}-/.test(s)) return { kind: "notice", id: s };
  if ((m = /^py:(\/.*)$/.exec(s))) return { kind: "prior_year", pointer: m[1] };
  if ((m = /^agency:(\/.*)$/.exec(s))) return { kind: "agency", pointer: m[1] };
  if ((m = /^ref:(.+)$/.exec(s))) return { kind: "engine_param", path: m[1].replace(/^param\./, "") };
  if (LINE_KEY.test(s)) return { kind: "line", key: s };
  return { kind: "unknown", raw: s };
}

/** Canonical string for a parsed reference, matching the packet's own spelling. */
export function formatRef(ref: Ref): string {
  switch (ref.kind) {
    case "value":
    case "questionnaire":
    case "message":
    case "call":
    case "staff":
    case "client_user":
    case "notice":
    case "timeline":
    case "version":
      return ref.id;
    case "document":
      return ref.page ? `doc:${ref.id}#page${ref.page}` : ref.id;
    case "line":
      return ref.key;
    case "person":
      return `household:${ref.id}`;
    case "asset":
      return `asset:${ref.id}`;
    case "prior_year":
      return `py:${ref.pointer}`;
    case "agency":
      return `agency:${ref.pointer}`;
    case "engine_param":
      return `ref:param.${ref.path}`;
    case "unknown":
      return ref.raw;
  }
}

/** Where a reference opens in the app. The one place that knows the routes. */
export function hrefFor(raw: string): string {
  const ref = parseRef(raw);
  switch (ref.kind) {
    case "value":
      return `/values/${ref.id}`;
    case "document":
      return `/documents/${ref.id}` + (ref.page ? `?page=${ref.page}` : "");
    case "line":
      return `/lines/${encodeURIComponent(ref.key)}`;
    case "version":
      return `/return?v=${ref.id}`;
    default:
      return `/r/${encodeURIComponent(raw)}`;
  }
}

export function documentHref(docId: string, opts: { page?: number; value?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.value) q.set("v", opts.value);
  const s = q.toString();
  return `/documents/${docId}` + (s ? `?${s}` : "");
}

export function lineHref(key: string, version?: string): string {
  return `/lines/${encodeURIComponent(key)}` + (version ? `?v=${version}` : "");
}

/** RFC 6901 JSON Pointer lookup. Returns undefined when the path does not exist. */
export function resolvePointer(root: unknown, pointer: string): unknown {
  if (pointer === "" || pointer === "/") return root;
  const parts = pointer
    .split("/")
    .slice(1)
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      const i = Number(part);
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return undefined;
      cur = cur[i];
    } else {
      const obj = cur as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, part)) return undefined;
      cur = obj[part];
    }
  }
  return cur;
}

/** Dotted path lookup used for engine parameters such as fx.SEK.2025_average. */
export function resolveDotted(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    const obj = cur as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(obj, part)) return undefined;
    cur = obj[part];
  }
  return cur;
}
