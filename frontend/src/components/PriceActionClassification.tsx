import type { Trade } from "../types";
import { displayClassification, entryTriggerOptions, findTaxonomyItem, locationTagOptions, marketStateOptions, tradeThesisOptions } from "../utils/priceActionTaxonomy";

function Value({ label, chinese, item, englishOnly }: { label: string; chinese: string; item: { english: string; chinese: string } | null; englishOnly: boolean }) {
  return <div><span>{label}{!englishOnly && <> / <span lang="zh">{chinese}</span></>}</span>{item ? <><strong>{item.english}</strong>{!englishOnly && <small lang="zh">{item.chinese}</small>}</> : <><strong>Not classified</strong>{!englishOnly && <small lang="zh">未分类</small>}</>}</div>;
}

export function PriceActionClassification({ trade, compact = false, englishOnly = false }: { trade: Trade; compact?: boolean; englishOnly?: boolean }) {
  const classification = displayClassification(trade);
  const state = findTaxonomyItem(marketStateOptions, classification.marketState);
  const thesis = findTaxonomyItem(tradeThesisOptions, classification.tradeThesis);
  const trigger = findTaxonomyItem(entryTriggerOptions, classification.entryTrigger);
  if (compact) return <section className="price-action-classification compact"><div className="classification-heading"><strong>Price Action{!englishOnly && <> / <span lang="zh">价格行为</span></>}</strong>{classification.legacy && <span>{englishOnly ? "Legacy classification" : "Legacy classification / 历史分类"}</span>}</div><p>{[state, thesis, trigger].map((item) => item ? `${item.english}${englishOnly ? "" : ` / ${item.chinese}`}` : `Not classified${englishOnly ? "" : " / 未分类"}`).join(" · ")}</p></section>;
  return <section className="price-action-classification"><div className="classification-heading"><strong>Price Action Classification{!englishOnly && <> / <span lang="zh">价格行为分类</span></>}</strong>{classification.legacy && <span>{englishOnly ? "Legacy classification" : "Legacy classification / 历史分类"}</span>}</div><div className="classification-values"><Value label="Market State" chinese="市场结构" item={state} englishOnly={englishOnly} /><Value label="Trade Thesis" chinese="交易逻辑" item={thesis} englishOnly={englishOnly} /><Value label="Entry Trigger" chinese="入场触发" item={trigger} englishOnly={englishOnly} /></div><div className="classification-locations"><span>Key Locations{!englishOnly && <> / <span lang="zh">关键位置</span></>}</span>{classification.locationTags.length ? <div>{classification.locationTags.map((value) => { const item = findTaxonomyItem(locationTagOptions, value); return item && <span key={value}>✓ {item.english}{!englishOnly && <> / <span lang="zh">{item.chinese}</span></>}</span>; })}</div> : <small>No key locations{!englishOnly && " / 未标记关键位置"}</small>}</div></section>;
}
