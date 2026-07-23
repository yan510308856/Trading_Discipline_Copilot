# Price action taxonomy / 价格行为分类

Stage 27 replaces the overloaded logical use of Setup and Market Context with five structured facts. The legacy columns remain unchanged as deprecated compatibility mirrors.

## Why normalization matters

The former Setup list mixed trade ideas (`breakout`), structures (`wedge`), triggers (`H2`), session locations (`opening_range`), and risky behavior (`left_side_bottom_pick`). Those concepts answer different questions and cannot support reliable rules or review when stored as one value.

## Exact terminology

### Market State / 市场结构

| Value | English | 中文 |
| --- | --- | --- |
| strong_trend | Strong Trend | 强趋势 |
| narrow_channel | Narrow Channel | 窄通道 |
| broad_channel | Broad Channel | 宽通道 |
| trading_range | Trading Range | 震荡区间 |
| breakout_mode | Breakout Mode | 突破模式 |
| unclear | Unclear | 结构不清 |

“Narrow Channel” is translated as **窄通道** because it describes limited channel width. Stage 27 does not use “Tight Channel / 紧密通道.” Weak Trend is consolidated into Broad Channel for new records.

### Trade Thesis / 交易逻辑

| Value | English | 中文 |
| --- | --- | --- |
| pullback_continuation | Pullback Continuation | 回调延续 |
| breakout | Breakout | 突破 |
| breakout_pullback | Breakout Pullback | 突破回踩 |
| failed_breakout | Failed Breakout | 突破失败 |
| range_reversal | Range Reversal | 区间边缘反转 |
| major_reversal | Major Trend Reversal | 主要趋势反转 |
| other | Other | 其他逻辑 |

### Entry Trigger / 入场触发

| Value | English | 中文 |
| --- | --- | --- |
| h1_h2_l1_l2 | H1 / H2 / L1 / L2 | 高一 / 高二 / 低一 / 低二 |
| second_entry | Second Entry | 二次入场 |
| wedge | Wedge | 楔形 |
| double_top_bottom | Double Top / Bottom | 双顶 / 双底 |
| inside_bar_triangle | Inside Bar / Triangle | 内包线 / 三角形 |
| strong_signal_bar | Strong Signal Bar | 强信号K线 |
| breakout_retest | Breakout Retest | 突破回测 |
| other | Other | 其他触发 |

A wedge or double top/bottom describes how entry is triggered, not whether the trade is continuation, range reversal, or major reversal. Historical records therefore map these patterns to an exact trigger but `trade_thesis=other`.

### Key Locations / 关键位置

`opening_range / 开盘区间`, `gap_open / 跳空开盘`, `range_high / 区间上沿`, `range_low / 区间下沿`, `prior_day_high / 昨高`, `prior_day_low / 昨低`, `support / 支撑`, `resistance / 阻力`, `pullback_zone / 回调区域`, and `breakout_point / 突破位` form an ordered, duplicate-free JSON list. Opening Range and Gap Open describe where or when a trade occurs, not its thesis.

## Unconfirmed reversal risk

`is_unconfirmed_reversal` records an early, left-side reversal attempt. It is not a normal setup. Options are blocked; stocks require warning acknowledgement, intentionally small size, structural invalidation, and no averaging down.

## Historical migration

- `weak_trend → broad_channel`; `narrow_channel` remains unchanged.
- `opening_range` and `gap_open` context become `unclear` plus the matching location tag.
- `breakout`, `pullback`, `failed_breakout`, and `reversal` map to their conservative thesis and `entry_trigger=other`.
- Wedge, double top/bottom, H1/H2/L1/L2, and inside bar/triangle map to `trade_thesis=other` plus the known trigger.
- Left-side/bottom-pick values map to major reversal and set the risk flag.

The original `setup` and `market_context` values are never overwritten by migration. New writes mirror the new source-of-truth fields back to legacy values for old consumers.

## Rule examples

```yaml
trigger:
  trade_thesis: range_reversal
conditions:
  - field: location_tags
    operator: contains_none
    value: [range_high, range_low]
```

The structured facts support actionable combinations without guessing market direction. The application still does not identify price action automatically or place broker orders.
