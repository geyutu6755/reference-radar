/**
 * Document-type / carrier code tables per standard version.
 *
 * 2025 codes were read directly from the official GB/T 7714—2025 Annex A
 * (verified-official; see docs/verification.md).
 * 2015 codes were confirmed via multiple independent secondary guides
 * (verified-secondary) and cross-checked with the official 2025 foreword,
 * which names every Annex-A change from 2015.
 */
import type { StandardVersion } from "../types";

export interface VersionCodeTable {
  typeCodes: Record<string, string>; // code → display name
  carrierCodes: Record<string, string>;
}

const CODES_2025: VersionCodeTable = {
  typeCodes: {
    M: "图书",
    J: "期刊",
    N: "报纸",
    C: "会议录",
    D: "学位论文",
    R: "报告",
    S: "标准",
    P: "专利",
    EB: "网站、网页",
    A: "档案",
    CM: "地图",
    DS: "数据集",
    PP: "预印本",
    G: "汇编",
    CP: "计算机程序",
    DB: "数据库",
    Z: "其他",
  },
  carrierCodes: {
    MT: "磁带",
    DK: "磁盘",
    CD: "光盘",
    OL: "联机网络",
    MM: "缩微资料",
  },
};

const CODES_2015: VersionCodeTable = {
  typeCodes: {
    M: "普通图书",
    J: "期刊",
    N: "报纸",
    C: "会议录",
    D: "学位论文",
    R: "报告",
    S: "标准",
    P: "专利",
    EB: "电子公告",
    A: "档案",
    CM: "舆图",
    G: "汇编",
    CP: "计算机程序",
    DB: "数据库",
    Z: "其他",
  },
  carrierCodes: {
    MT: "磁带",
    DK: "磁盘",
    CD: "光盘",
    OL: "联机网络",
  },
};

export function codeTable(version: StandardVersion): VersionCodeTable {
  return version === "2025" ? CODES_2025 : CODES_2015;
}

/** Codes defined in the other version but not this one. */
export function codesOnlyInOther(version: StandardVersion): { types: string[]; carriers: string[] } {
  const mine = codeTable(version);
  const other = codeTable(version === "2025" ? "2015" : "2025");
  const types = Object.keys(other.typeCodes).filter((c) => !(c in mine.typeCodes));
  const carriers = Object.keys(other.carrierCodes).filter((c) => !(c in mine.carrierCodes));
  return { types, carriers };
}
