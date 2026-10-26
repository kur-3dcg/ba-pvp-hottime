import { useEffect, useRef, useState } from "react";
import { BarChart3, Grid3X3, ArrowUpRight } from "lucide-react";
import {
  COLORS,
  dateKey,
  hourOf,
  type Player,
  type RecordEntry,
} from "./model";
const demoPlayers: Player[] = ["プレイヤーA", "プレイヤーB", "プレイヤーC"].map(
  (name, i) => ({ id: `demo-${i}`, name, iconId: null }),
);
function demoRecords(): RecordEntry[] {
  const now = Date.now();
  return Array.from({ length: 36 }, (_, i) => {
    const day = now - (i % 7) * 86400000;
    const hour = [12, 13, 19, 20, 21, 22][i % 6];
    const at =
      Date.parse(`${dateKey(day)}T${hour}:15:00+09:00`) + (i % 3) * 8 * 60000;
    return {
      id: `d${i}`,
      playerId: `demo-${i % 3}`,
      at,
      baseAt: at,
      elapsedMinutes: 0,
      precision: "minute",
      source: "manual",
    };
  });
}
export function Chart({
  records,
  players,
  selected,
  onSelection,
}: {
  records: RecordEntry[];
  players: Player[];
  selected: string[];
  onSelection: (ids: string[]) => void;
}) {
  const [mode, setMode] = useState<"heatmap" | "bar">("heatmap");
  const [scope, setScope] = useState("all");
  const [period, setPeriod] = useState("all");
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(false);
  }, [records]);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(980);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setPlotWidth(Math.max(280, entry.contentRect.width)),
    );
    if (plotRef.current) observer.observe(plotRef.current);
    return () => observer.disconnect();
  }, []);
  const ps = demo ? demoPlayers : players;
  const source = demo ? demoRecords() : records;
  const ids =
    scope === "all"
      ? ps.map((p) => p.id)
      : demo
        ? ps.slice(0, scope === "one" ? 1 : 2).map((p) => p.id)
        : selected;
  const today = Date.parse(`${dateKey(Date.now())}T00:00:00+09:00`);
  const cutoff =
    period === "all" ? -Infinity : today - (Number(period) - 1) * 86400000;
  const filtered = source.filter(
    (r) => (scope === "all" || ids.includes(r.playerId)) && r.at >= cutoff,
  );
  const active = ps.filter((p) => ids.includes(p.id));
  const bins = Array.from({ length: 24 }, () => 0);
  filtered.forEach((r) => bins[hourOf(r.at)]++);
  const maximum = Math.max(4, Math.ceil(Math.max(...bins) / 4) * 4);
  const valid =
    scope === "multi"
      ? ids.length >= 2 && ids.length <= 10
      : scope === "one"
        ? ids.length === 1
        : true;
  const plot = filtered.length > 0 && valid;
  const heatMax = Math.max(1, ...bins);
  const heatColor = (count: number) =>
    count ? `hsl(207 85% ${94 - (55 * count) / heatMax}%)` : "#f0f4f8";
  const color = (id: string) =>
    COLORS[
      Math.max(
        0,
        ps.findIndex((p) => p.id === id),
      ) % COLORS.length
    ];
  const W = plotWidth,
    H = plotWidth < 580 ? 240 : 292,
    L = plotWidth < 580 ? 40 : 56,
    R = 20,
    T = 25,
    B = 38,
    pw = W - L - R,
    ph = H - T - B;
  const yTicks = [0, 1, 2, 3, 4];
  function toggle(id: string) {
    if (scope === "one") {
      onSelection([id]);
      return;
    }
    if (selected.includes(id)) onSelection(selected.filter((x) => x !== id));
    else if (selected.length < 10) onSelection([...selected, id]);
  }
  return (
    <section className="panel chart-panel" aria-label="防御時間のグラフ">
      <div className="section-top">
        <div>
          <div className="eyebrow">ACTIVITY OVERVIEW</div>
          <h2>
            防御した時間帯{" "}
            <span className="count-pill">{filtered.length} 件</span>
          </h2>
        </div>
        <div className="segmented" aria-label="グラフ形式">
          <button
            className={mode === "heatmap" ? "active" : ""}
            onClick={() => setMode("heatmap")}
            aria-pressed={mode === "heatmap"}
          >
            <Grid3X3 size={16} />
            ヒートマップ
          </button>
          <button
            className={mode === "bar" ? "active" : ""}
            onClick={() => setMode("bar")}
            aria-pressed={mode === "bar"}
          >
            <BarChart3 size={16} />
            棒グラフ
          </button>
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="tabs" aria-label="集計対象">
          {[
            ["all", "全体"],
            ["one", "個人"],
            ["multi", "複数人比較"],
          ].map(([v, label]) => (
            <button
              key={v}
              aria-pressed={scope === v}
              className={scope === v ? "active" : ""}
              onClick={() => {
                setScope(v);
                if (v === "one")
                  onSelection(
                    selected.length
                      ? [selected[0]]
                      : players.slice(0, 1).map((p) => p.id),
                  );
                if (v === "multi" && selected.length < 2)
                  onSelection(players.slice(0, 2).map((p) => p.id));
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-label">
          集計期間
          <select
            aria-label="集計期間"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">すべての期間</option>
            <option value="7">直近7日</option>
            <option value="30">直近30日</option>
            <option value="90">直近90日</option>
          </select>
        </label>
      </div>
      {scope !== "all" && !demo && (
        <div className="player-chips">
          {players.length === 0 ? (
            <span>プレイヤーを記録すると選べます。</span>
          ) : (
            players.map((p) => (
              <button
                key={p.id}
                className={selected.includes(p.id) ? "selected" : ""}
                disabled={
                  scope === "multi" &&
                  !selected.includes(p.id) &&
                  selected.length >= 10
                }
                onClick={() => toggle(p.id)}
                aria-pressed={selected.includes(p.id)}
              >
                <i style={{ background: color(p.id) }} />
                {p.name}
              </button>
            ))
          )}
          {scope === "multi" && (
            <small>{selected.length}/10人選択（2人以上）</small>
          )}
        </div>
      )}
      {demo && (
        <div className="sample-banner">
          表示サンプル · 架空の記録です。保存データには含まれません。
          <button onClick={() => setDemo(false)}>自分の記録に戻る</button>
        </div>
      )}
      <div className="plot-wrap" ref={plotRef}>
        {mode === "bar" && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="時間帯別の防御件数の棒グラフ"
          >
            <defs>
              <linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#329cf4" />
                <stop offset="1" stopColor="#7fc2fa" />
              </linearGradient>
            </defs>
            {yTicks.map((i) => {
              const y = T + (ph * i) / 4;
              const label = Math.ceil((maximum * (4 - i)) / 4);
              return (
                <g key={i}>
                  <line
                    x1={L}
                    x2={W - R}
                    y1={y}
                    y2={y}
                    stroke="#e8edf3"
                    strokeDasharray="3 5"
                  />
                  {plot && (
                    <text
                      x={L - 12}
                      y={y + 4}
                      textAnchor="end"
                      className="axis-label"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
            {Array.from(
              { length: plotWidth < 580 ? 7 : 13 },
              (_, i) => i * (plotWidth < 580 ? 4 : 2),
            ).map((h) => (
              <g key={h}>
                <line
                  x1={L + (h / 24) * pw}
                  x2={L + (h / 24) * pw}
                  y1={T}
                  y2={H - B}
                  stroke="#eff3f7"
                />
                <text
                  x={L + (h / 24) * pw}
                  y={H - 12}
                  textAnchor="middle"
                  className="axis-label"
                >
                  {String(h).padStart(2, "0")}:00
                </text>
              </g>
            ))}
            {plot &&
              mode === "bar" &&
              bins.map((count, h) => {
                const gap = plotWidth < 580 ? 3 : 10;
                const bw = pw / 24 - gap;
                let stacked = 0;
                return (
                  <g key={h}>
                    {scope === "multi" ? (
                      active.map((p) => {
                        const n = filtered.filter(
                          (r) => r.playerId === p.id && hourOf(r.at) === h,
                        ).length;
                        stacked += n;
                        return (
                          <rect
                            key={p.id}
                            x={L + (h / 24) * pw + gap / 2}
                            y={T + ph * (1 - stacked / maximum)}
                            width={bw}
                            height={(ph * n) / maximum}
                            fill={color(p.id)}
                            rx="2"
                          >
                            <title>
                              {p.name} · {h}時台: {n}件
                            </title>
                          </rect>
                        );
                      })
                    ) : (
                      <rect
                        x={L + (h / 24) * pw + gap / 2}
                        y={T + ph * (1 - count / maximum)}
                        width={bw}
                        height={(ph * count) / maximum}
                        rx="5"
                        fill="url(#bar-fill)"
                      >
                        <title>
                          {h}時台: {count}件
                          {active.length > 1
                            ? "\n" +
                              active
                                .map(
                                  (p) =>
                                    `${p.name}: ${filtered.filter((r) => r.playerId === p.id && hourOf(r.at) === h).length}件`,
                                )
                                .join("\n")
                            : ""}
                        </title>
                      </rect>
                    )}
                    {count > 0 && (
                      <text
                        x={L + ((h + 0.5) / 24) * pw}
                        y={T + ph * (1 - count / maximum) - 7}
                        textAnchor="middle"
                        className="bar-label"
                      >
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}
          </svg>
        )}
        {mode === "heatmap" && plot && (
          <div
            className="hour-heatmap"
            aria-label="時間帯別の防御件数のヒートマップ"
          >
            {bins.map((count, h) => (
              <div
                key={h}
                className="heat-cell"
                tabIndex={0}
                style={{
                  background: heatColor(count),
                  color: count / heatMax > 0.6 ? "#fff" : "#204361",
                }}
                title={active
                  .map(
                    (p) =>
                      p.name +
                      ": " +
                      filtered.filter(
                        (r) => r.playerId === p.id && hourOf(r.at) === h,
                      ).length +
                      "件",
                  )
                  .join("\n")}
                aria-label={h + "時台: " + count + "件"}
              >
                <span>{String(h).padStart(2, "0")}:00</span>
                <strong>
                  {count}
                  <small> 件</small>
                </strong>
              </div>
            ))}
          </div>
        )}
        {!plot && (
          <div className="chart-empty">
            <div className="empty-mark">
              <Grid3X3 size={28} />
            </div>
            <strong>
              {!valid
                ? "比較するプレイヤーを選択してください"
                : "データが不足しています"}
            </strong>
            <p>
              {!valid
                ? "個人は1人、複数人比較は2〜10人を選べます。"
                : "防御した時刻を記録すると、ここにグラフが表示されます。"}
            </p>
            {!valid ? null : (
              <button className="text-button" onClick={() => setDemo(true)}>
                グラフの表示サンプルを見る <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="chart-foot">
        <div className="legend">
          {mode === "heatmap" && (
            <span>
              少{" "}
              <i
                style={{
                  background:
                    "linear-gradient(90deg, #f0f4f8, hsl(207 85% 39%))",
                  width: 80,
                  borderRadius: 3,
                }}
              />{" "}
              多（最大{heatMax}件）
            </span>
          )}
          {mode === "bar" &&
            scope === "multi" &&
            active.slice(0, 10).map((p) => (
              <span key={p.id}>
                <i style={{ background: color(p.id) }} />
                {p.name}
              </span>
            ))}
          {mode === "bar" && scope !== "multi" && (
            <span>
              <i style={{ background: "#1687ed" }} />
              選択したプレイヤーの合計件数
            </span>
          )}
        </div>
        <span>
          日本時間（JST）
          {mode === "heatmap"
            ? " · 1マス = 1時間の合計件数"
            : " · 1時間ごとに集計"}
        </span>
      </div>
    </section>
  );
}
