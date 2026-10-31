import { XMLParser, XMLValidator } from "fast-xml-parser";

/**
 * XML utilities for OOXML parts.
 *
 * Security notes:
 * - fast-xml-parser does not evaluate DTDs, so external/billion-laughs entity
 *   expansion cannot occur. `processEntities` only decodes predefined entities
 *   (&amp; &lt; &gt; &quot; &apos;) and numeric character references.
 * - Values are kept unparsed (no auto number/date coercion).
 */

const parser = new XMLParser({
  removeNSPrefix: true,
  processEntities: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  // Keep repeated elements as arrays even when they appear once.
  isArray: (name) =>
    [
      "p",
      "r",
      "t",
      "delText",
      "instrText",
      "fldChar",
      "tab",
      "br",
      "hyperlink",
      "tbl",
      "tr",
      "tc",
      "footnote",
      "endnote",
      "lvl",
      "num",
      "abstractNum",
      "oMath",
      "oMathPara",
      "drawing",
      "object",
    ].includes(name),
});

export type XmlNode = Record<string, unknown>;

/** Parse an XML document string; throws Error with readable message on failure. */
export function parseXml(xml: string): XmlNode {
  const check = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (check !== true) {
    const where = check.err && typeof check.err === "object" ? ` (line ${check.err.line})` : "";
    throw new Error(`XML 结构无效${where} / Invalid XML structure${where}`);
  }
  return parser.parse(xml) as XmlNode;
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  if (!node) return undefined;
  const v = node[name];
  if (Array.isArray(v)) return v[0] as XmlNode | undefined;
  return v as XmlNode | undefined;
}

export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  if (!node) return [];
  return asArray(node[name] as XmlNode | XmlNode[] | undefined);
}

export function attr(node: XmlNode | undefined, name: string): string | undefined {
  if (!node) return undefined;
  const v = node[`@_${name}`];
  return v === undefined || v === null ? undefined : String(v);
}

export function attrNum(node: XmlNode | undefined, name: string): number | undefined {
  const s = attr(node, name);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Concatenate direct text values of a node list. */
export function textOf(nodes: XmlNode[]): string {
  let out = "";
  for (const n of nodes) {
    const t = (n as Record<string, unknown>)["#text"];
    if (typeof t === "string") out += t;
  }
  return out;
}
