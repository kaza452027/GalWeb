// scripts/gen-manifest.mjs
// scripts/gen-manifest.mjs  —— 基于 game.json 合并 meta.json 的增量补丁
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_GAMES = path.join(ROOT, 'assets', 'games.json');   // 基底
const SRC_META  = path.join(ROOT, 'assets', 'meta.json');    // 含 patches[]
const OUT_DIR   = path.join(ROOT, 'dist');
const OUT_FILE  = path.join(OUT_DIR, 'manifest.json');

// 读取
const base = JSON.parse(readFileSync(SRC_GAMES, 'utf8'));           // Array<game>
const meta = JSON.parse(readFileSync(SRC_META, 'utf8'));            // { patches?: Array<object> }
const patchesArr = Array.isArray(meta.patches) ? meta.patches : [];

// 工具：深合并，仅覆盖“显式提供”的键；对象深并，数组整替
function deepMerge(baseObj, patchObj) {
  if (!patchObj || typeof patchObj !== 'object' || Array.isArray(patchObj)) return patchObj ?? baseObj;
  const out = { ...baseObj };
  for (const [k, v] of Object.entries(patchObj)) {
    if (v === undefined) continue;
    const bv = baseObj?.[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, v);
    } else {
      out[k] = v; // 原子或数组：整替
    }
  }
  return out;
}

// 构建 id → patch 映射
const patchById = new Map();
for (const p of patchesArr) {
  if (!p || typeof p !== 'object' || !p.id) continue;
  // 同 id 多个补丁时后者覆盖前者
  patchById.set(p.id, { ...patchById.get(p.id), ...p });
}

// 合并：基底 + 补丁；meta 中新增的 id 也加入
const baseById = new Map(base.map(g => [g.id, g]));
const seen = new Set();
const merged = [];

// 先处理已有条目
for (const g of base) {
  const p = patchById.get(g.id);
  merged.push(p ? deepMerge(g, p) : g);
  seen.add(g.id);
}

// 再加入 meta 中新增的条目
for (const p of patchById.values()) {
  if (!seen.has(p.id)) merged.push(p);
}

// 输出
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2));
console.log(`OK 生成 ${OUT_FILE}，条目数：${merged.length}`);
