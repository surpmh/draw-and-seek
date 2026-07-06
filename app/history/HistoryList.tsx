"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";

interface HistoryItem {
  id: string;
  nickname: string;
  found: boolean;
  hiddenAt: string;
  foundAt: string | null;
  survivedMs: number;
  thumbnailUrl: string;
}

type Filter = "all" | "hidden" | "found";


const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const MEDALS = [
  { medal: "🥇", color: "var(--gold)", order: 2, thumb: 76, padB: 28 },
  { medal: "🥈", color: "var(--silver)", order: 1, thumb: 62, padB: 20 },
  { medal: "🥉", color: "var(--bronze)", order: 3, thumb: 62, padB: 20 },
];

export default function HistoryList() {
  const { t } = useI18n();
  // 모바일: 포디움·타이틀 없이 검색 + 리스트만, 행은 컴팩트 레이아웃
  const isMobile = useIsMobile();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setTheme(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  // 숨은 시간 표기 (언어별)
  const survivedLabel = (ms: number) => {
    const days = Math.floor(ms / 86400_000);
    const hours = Math.floor((ms % 86400_000) / 3600_000);
    if (days >= 1) return t.durDays(days, hours);
    const h = Math.floor(ms / 3600_000);
    if (h >= 1) return t.durHours(h);
    return t.durUnderHour;
  };

  const q = query.trim().toLowerCase();
  // 순위는 전체 기준으로 매긴 뒤 필터 (검색·필터해도 원래 순위 유지)
  const ranked = (items ?? []).map((it, i) => ({ it, rank: i + 1 }));
  const rows = ranked.filter(({ it }) => {
    if (q && !it.nickname.toLowerCase().includes(q)) return false;
    if (filter === "hidden" && it.found) return false;
    if (filter === "found" && !it.found) return false;
    return true;
  });
  const podium = ranked.slice(0, 3);

  const chip = (key: Filter, label: string) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      style={{
        height: 42,
        padding: "0 16px",
        borderRadius: 12,
        border: `1px solid ${filter === key ? "var(--accent)" : "var(--line)"}`,
        background: filter === key ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "var(--surface)",
        color: filter === key ? "var(--accent)" : "var(--text2)",
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "all .2s",
      }}
    >
      {label}
    </button>
  );

  const cols = "52px 56px 1fr 130px 150px 96px";

  return (
    <div
      className="hc"
      data-theme={theme}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        backgroundImage: "radial-gradient(var(--dot) 1.5px, transparent 1.5px)",
        backgroundSize: "30px 30px",
        color: "var(--text)",
        fontFamily: "var(--font-inter), Inter, -apple-system, 'Segoe UI', sans-serif",
        overflowY: "auto",
      }}
    >
      {/* 헤더 (기존 유지) */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          background: "var(--surface)",
          backdropFilter: "blur(10px) saturate(1.5)",
          WebkitBackdropFilter: "blur(10px) saturate(1.5)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link
          href="/"
          title={t.backToCanvas}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            color: "var(--text2)",
            textDecoration: "none",
            fontSize: 16,
          }}
        >
          ←
        </Link>
        {/* 모바일은 본문 타이틀을 생략하는 대신 네비게이션 바에 제목 표기 */}
        {isMobile && (
          <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.015em" }}>{t.historyTitle}</div>
        )}
      </nav>

      <main style={{ maxWidth: 920, margin: "0 auto", padding: isMobile ? "16px 12px 56px" : "40px 24px 80px" }}>
        {/* 타이틀 */}
        {!isMobile && (
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {t.hallOfFame}
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {t.historyTitle}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
            {t.historySubtitle}
          </p>
        </header>
        )}

        {/* 포디움 Top 3 (데스크톱 전용) */}
        {!isMobile && podium.length === 3 && (
          <section
            data-screen-label="Podium"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
              alignItems: "end",
              marginBottom: 28,
            }}
          >
            {podium.map(({ it }, i) => {
              const m = MEDALS[i];
              return (
                <div
                  key={it.id}
                  style={{
                    order: m.order,
                    background: "var(--surface)",
                    backdropFilter: "blur(10px) saturate(1.5)",
                    WebkitBackdropFilter: "blur(10px) saturate(1.5)",
                    border: "1px solid var(--line)",
                    borderTop: `3px solid ${m.color}`,
                    borderRadius: 16,
                    boxShadow: "var(--shadow)",
                    padding: `20px 16px ${m.padB}px`,
                    textAlign: "center",
                    animation: "popIn .4s cubic-bezier(.3,1.3,.5,1) both",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{m.medal}</div>
                  <div
                    style={{
                      width: m.thumb,
                      height: m.thumb,
                      borderRadius: 16,
                      background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                      border: "1px solid var(--line)",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 12px",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={it.thumbnailUrl}
                      alt=""
                      style={{ maxWidth: m.thumb - 12, maxHeight: m.thumb - 12, objectFit: "contain" }}
                    />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{it.nickname}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 3 }}>{t.hiddenOnDate(fmtDate(it.hiddenAt))}</div>
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 13,
                      fontWeight: 800,
                      color: m.color,
                      background: `color-mix(in oklab, ${m.color} 12%, transparent)`,
                      borderRadius: 999,
                      padding: "5px 12px",
                    }}
                  >
                    {survivedLabel(it.survivedMs)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 8 }}>
                    {it.found && it.foundAt ? t.foundOnDate(fmtDate(it.foundAt)) : t.stillHidden}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* 검색 + 필터 */}
        <section style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 13,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                filter: "grayscale(1)",
                opacity: 0.6,
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: 42,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--text)",
                padding: "0 38px",
                fontSize: 13.5,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            {q && (
              <button
                onClick={() => setQuery("")}
                title={t.clearSearch}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  border: "none",
                  background: "color-mix(in oklab, var(--text) 8%, transparent)",
                  color: "var(--text2)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {chip("all", t.filterAll)}
            {chip("hidden", t.filterHidden)}
            {chip("found", t.filterFound)}
          </div>
        </section>

        {/* 결과 수 */}
        <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10, paddingLeft: 4 }}>
          {items === null ? "…" : q ? t.searchResults(query.trim(), rows.length) : t.totalRecords(rows.length)}
        </div>

        {/* 목록 */}
        <section
          data-screen-label="History List"
          style={{
            background: "var(--surface)",
            backdropFilter: "blur(10px) saturate(1.5)",
            WebkitBackdropFilter: "blur(10px) saturate(1.5)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          {!isMobile && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 12,
              alignItems: "center",
              padding: "12px 20px",
              borderBottom: "1px solid var(--line)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text2)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            <div style={{ textAlign: "center" }}>{t.colRank}</div>
            <div />
            <div>{t.colNickname}</div>
            <div>{t.colHiddenDate}</div>
            <div>{t.colResult}</div>
            <div style={{ textAlign: "right" }}>{t.colDuration}</div>
          </div>
          )}

          {rows.map(({ it, rank }) => {
            // 모바일: 순위·썸네일·닉네임/날짜·기록(상태)만 한 줄로 — 폰 폭에 맞춘 컴팩트 행
            if (isMobile) {
              return (
                <div
                  key={it.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "30px 44px minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "11px 12px",
                    borderBottom: "1px solid var(--line)",
                    animation: "rowIn .3s ease both",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: rank <= 3 ? 16 : 13,
                      fontWeight: 800,
                      color: rank <= 3 ? "var(--text)" : "var(--text2)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                      border: "1px solid var(--line)",
                      overflow: "hidden",
                      padding: 3,
                    }}
                  >
                    <img
                      src={it.thumbnailUrl}
                      alt=""
                      style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
                      loading="lazy"
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {it.nickname}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text2)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      {fmtDate(it.hiddenAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
                      {survivedLabel(it.survivedMs)}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 3,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: it.found ? "var(--text2)" : "#22A06B",
                        background: `color-mix(in oklab, ${it.found ? "var(--text2)" : "#22A06B"} 11%, transparent)`,
                        borderRadius: 999,
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.found ? t.stFound : t.stHidden}
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--line)",
                  animation: "rowIn .3s ease both",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    fontSize: rank <= 3 ? 17 : 14,
                    fontWeight: 800,
                    color: rank <= 3 ? "var(--text)" : "var(--text2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "color-mix(in oklab, var(--accent) 9%, transparent)",
                    border: "1px solid var(--line)",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={it.thumbnailUrl}
                    alt=""
                    style={{ maxWidth: 38, maxHeight: 38, objectFit: "contain" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.nickname}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtDate(it.hiddenAt)}
                </div>
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: it.found ? "var(--text2)" : "#22A06B",
                      background: `color-mix(in oklab, ${it.found ? "var(--text2)" : "#22A06B"} 11%, transparent)`,
                      borderRadius: 999,
                      padding: "4px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.found ? t.stFound : t.stHidden}
                  </span>
                  {it.found && it.foundAt && (
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>{fmtDate(it.foundAt)}</div>
                  )}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 15,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {survivedLabel(it.survivedMs)}
                </div>
              </div>
            );
          })}

          {items !== null && rows.length === 0 && (
            <div style={{ padding: "56px 20px", textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 14px",
                  fontSize: 26,
                }}
              >
                🔍
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {q ? t.noResultsTitle : t.noRecordsTitle}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text2)" }}>
                {q ? t.noResultsDesc(query.trim()) : t.noRecordsDesc}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
