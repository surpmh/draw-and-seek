"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ko" | "en" | "ja" | "zh" | "es" | "fr" | "de";

export interface Dict {
  // ---- 공통/네비 ----
  remainCount: (n: number) => string;
  helpButton: string;
  backToCanvas: string;
  close: string;

  // ---- 경과 시간 ----
  justHidden: string; // 방금 숨겨짐
  hiddenForDays: (d: number) => string; // N일째 숨어있음
  hiddenForHours: (h: number) => string;
  badgeNew: string;
  badgeDays: (d: number) => string;
  badgeHours: (h: number) => string;
  foundAfter: (label: string) => string; // {N일} 만에 발견
  durDays: (d: number, h: number) => string; // 히스토리 "N일 N시간"
  durHours: (h: number) => string;
  durUnderHour: string;

  // ---- 사이드바 ----
  myDrawing: string;


  // ---- 랭킹 ----
  rankingTitle: string;
  rankingPill: string;
  rankingEmpty: string;
  rankingHistoryLink: string;
  rankingCollapse: string;
  rankingExpand: string;

  // ---- 발견 ----
  foundBanner: (nickname: string) => string;

  // ---- 그림판 ----
  draw: string;
  drawHint: string;
  collapsePanel: string;
  openPanel: string;
  toolPen: string;
  toolFill: string;
  toolEraser: string;
  pickColor: string;
  pickFromScreen: string;
  brush: string;
  clear: string;
  undo: string;
  redo: string;
  minimapLabel: string;
  minimapTitle: string;
  upload: string;

  // ---- 업로드/배치 ----
  stepBadge: string;
  stepTitle: string;
  stepDesc: string;
  nickname: string;
  nicknamePlaceholder: string;
  size: string;
  cancel: string;
  complete: string;
  submitting: string;

  // ---- 토스트 ----
  drawFirst: string;
  tooSmall: string;
  tooFaint: string;
  hideSuccess: string;
  uploadFailed: (msg: string) => string;
  networkError: string;
  tooFast: string;

  // ---- 빈 상태 ----
  emptyTitle: string;
  emptyDesc: string;

  // ---- 도움말 ----
  helpTitle: string;
  helpSteps: { title: string; body: string }[];
  cautionsTitle: string;
  cautions: string[];
  tipLabel: string;
  tip: string;

  // ---- 히스토리 ----
  historyNav: string;
  hallOfFame: string;
  historyTitle: string;
  historySubtitle: string;
  searchPlaceholder: string;
  clearSearch: string;
  filterAll: string;
  filterHidden: string;
  filterFound: string;
  totalRecords: (n: number) => string;
  searchResults: (q: string, n: number) => string;
  colRank: string;
  colNickname: string;
  colHiddenDate: string;
  colResult: string;
  colDuration: string;
  stFound: string;
  stHidden: string;
  hiddenOnDate: (date: string) => string; // 포디움 "YYYY.MM.DD 숨김"
  foundOnDate: (date: string) => string;
  stillHidden: string;
  noResultsTitle: string;
  noResultsDesc: (q: string) => string;
  noRecordsTitle: string;
  noRecordsDesc: string;
}

const ko: Dict = {
  remainCount: (n) => `${n}개 숨어있음`,
  helpButton: "게임 방법 및 주의사항",
  backToCanvas: "캔버스로 돌아가기",
  close: "닫기",

  justHidden: "방금 숨겨짐",
  hiddenForDays: (d) => `${d}일째 숨어있음`,
  hiddenForHours: (h) => `${h}시간째 숨어있음`,
  badgeNew: "NEW",
  badgeDays: (d) => `${d}일`,
  badgeHours: (h) => `${h}시간`,
  foundAfter: (label) => ` · ${label} 만에 발견`,
  durDays: (d, h) => (h >= 1 ? `${d}일 ${h}시간` : `${d}일`),
  durHours: (h) => `${h}시간`,
  durUnderHour: "1시간 미만",

  myDrawing: "내 그림",


  rankingTitle: "🏆 숨은 그림 Top 10",
  rankingPill: "랭킹",
  rankingEmpty: "아직 랭킹이 없어요",
  rankingHistoryLink: "지난 기록 — 오래 버틴 그림들",
  rankingCollapse: "랭킹 숨기기",
  rankingExpand: "랭킹 열기",

  foundBanner: (nickname) => `🔍 Found! · ${nickname}님의 그림`,

  draw: "그리기",
  drawHint: "그림을 그려서 캔버스 어딘가에 숨겨보세요",
  collapsePanel: "패널 접기",
  openPanel: "열기",
  toolPen: "펜",
  toolFill: "채우기",
  toolEraser: "지우개",
  pickColor: "원하는 색 직접 선택",
  pickFromScreen: "화면에서 색 추출",
  brush: "굵기",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "캔버스에서의 크기",
  minimapTitle: "그림이 캔버스에서 차지하는 크기 (기본값 기준)",
  upload: "Upload",

  stepBadge: "STEP 2 / 2",
  stepTitle: "위치 · 크기 · 닉네임",
  stepDesc: "그림을 드래그해 숨길 위치를 정하고, 크기를 조절하세요. 캔버스는 계속 이동·확대할 수 있어요.",
  nickname: "닉네임",
  nicknamePlaceholder: "숨긴 사람 이름",
  size: "크기",
  cancel: "취소",
  complete: "Complete",
  submitting: "숨기는 중…",

  drawFirst: "먼저 패널에 그림을 그려주세요 ✏️",
  tooSmall: "그림이 너무 작아요 — 조금만 더 크게 그려주세요",
  tooFaint: "그림이 너무 희미해요 — 좀 더 그려주세요",
  hideSuccess: "🎉 그림을 숨겼어요! 아무도 못 찾길 바라며",
  uploadFailed: (msg) => `업로드 실패: ${msg}`,
  networkError: "네트워크 오류로 업로드에 실패했어요",
  tooFast: "잠시 천천히! 클릭이 너무 빨라요",

  emptyTitle: "아직 숨겨진 그림이 없습니다",
  emptyDesc: "아래 그림판에서 첫 번째 그림을 숨겨보세요!",

  helpTitle: "게임 방법",
  helpSteps: [
    { title: "거대한 캔버스 탐험", body: "드래그로 이동하고 확대·축소하며 구석구석 살펴볼 수 있습니다." },
    {
      title: "숨겨진 그림 찾기",
      body: "다른 플레이어들이 캔버스 곳곳에 작은 그림을 숨겨두었습니다. 왼쪽 목록의 썸네일이 찾아야 할 그림의 힌트입니다.",
    },
    { title: "발견 시 제거", body: "찾아낸 그림은 모두에게 발견된 것으로 처리되어 캔버스와 목록에서 사라집니다." },
    {
      title: "나만의 그림 숨기기",
      body: "하단 그림판에 그림을 그린 뒤 Upload 버튼을 누릅니다. 원하는 위치로 드래그해 배치하고 Complete를 누르면 다른 플레이어들이 찾아야 할 새로운 숨은 그림이 등록됩니다.",
    },
    {
      title: "랭킹 도전",
      body: "오랫동안 발견되지 않은 그림일수록 랭킹 상위에 남습니다. 누구도 쉽게 찾지 못할 그림을 숨겨 최고 기록에 도전해 보시기 바랍니다.",
    },
  ],
  cautionsTitle: "📌 주의사항",
  cautions: [
    "다른 사람이 찾을 수 있을 정도의 크기와 선명도로 그려주시기 바랍니다.",
    "지나치게 흐리거나 식별이 어려운 그림은 삭제될 수 있습니다.",
    "욕설, 음란물, 혐오 표현 등 부적절한 콘텐츠는 삭제 대상입니다.",
    "운영 정책에 따라 관리자가 그림을 삭제할 수 있습니다.",
  ],
  tipLabel: "💡 Tip",
  tip: "AI로 생성한 캔버스 특성상 일부 동물이나 사물의 형태가 다소 독특할 수 있습니다. 이러한 어색함도 숨은그림찾기의 재미로 즐겨 주시기 바랍니다.",

  historyNav: "히스토리",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 역대 가장 오래 숨은 그림",
  historySubtitle: "발견되기까지 가장 오래 버텨 온 그림들. 아직 숨어있는 그림도 포함됩니다.",
  searchPlaceholder: "닉네임으로 검색…",
  clearSearch: "지우기",
  filterAll: "전체",
  filterHidden: "숨어있음",
  filterFound: "발견됨",
  totalRecords: (n) => `총 ${n}개의 기록`,
  searchResults: (q, n) => `"${q}" 검색 결과 ${n}건`,
  colRank: "순위",
  colNickname: "닉네임",
  colHiddenDate: "숨긴 날짜",
  colResult: "결과",
  colDuration: "숨은 시간",
  stFound: "발견됨",
  stHidden: "🤫 아직 숨어있음",
  hiddenOnDate: (date) => `${date} 숨김`,
  foundOnDate: (date) => `${date} 발견`,
  stillHidden: "아직 숨어있음 🤫",
  noResultsTitle: "검색 결과가 없습니다",
  noResultsDesc: (q) => `"${q}" 닉네임으로 숨긴 그림을 찾지 못했습니다`,
  noRecordsTitle: "아직 기록이 없습니다",
  noRecordsDesc: "첫 번째 기록의 주인공이 되어 보시기 바랍니다",
};

const en: Dict = {
  remainCount: (n) => `${n} hidden`,
  helpButton: "How to play & rules",
  backToCanvas: "Back to canvas",
  close: "Close",

  justHidden: "Just hidden",
  hiddenForDays: (d) => `Hidden for ${d} day${d === 1 ? "" : "s"}`,
  hiddenForHours: (h) => `Hidden for ${h} hour${h === 1 ? "" : "s"}`,
  badgeNew: "NEW",
  badgeDays: (d) => `${d}d`,
  badgeHours: (h) => `${h}h`,
  foundAfter: (label) => ` · found after ${label}`,
  durDays: (d, h) => (h >= 1 ? `${d}d ${h}h` : `${d}d`),
  durHours: (h) => `${h}h`,
  durUnderHour: "< 1 hour",

  myDrawing: "Mine",


  rankingTitle: "🏆 Hidden Drawings Top 10",
  rankingPill: "Ranking",
  rankingEmpty: "No rankings yet",
  rankingHistoryLink: "Past records — longest survivors",
  rankingCollapse: "Hide ranking",
  rankingExpand: "Show ranking",

  foundBanner: (nickname) => `🔍 Found! · drawing by ${nickname}`,

  draw: "Draw",
  drawHint: "Draw something and hide it somewhere on the canvas",
  collapsePanel: "Collapse panel",
  openPanel: "Open",
  toolPen: "Pen",
  toolFill: "Fill",
  toolEraser: "Eraser",
  pickColor: "Pick a custom color",
  pickFromScreen: "Pick color from screen",
  brush: "Size",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "Size on canvas",
  minimapTitle: "How big your drawing appears on the canvas (default)",
  upload: "Upload",

  stepBadge: "STEP 2 / 2",
  stepTitle: "Position · Size · Nickname",
  stepDesc: "Drag your drawing to choose a hiding spot and adjust its size. You can still pan and zoom the canvas.",
  nickname: "Nickname",
  nicknamePlaceholder: "Your name",
  size: "Size",
  cancel: "Cancel",
  complete: "Complete",
  submitting: "Hiding…",

  drawFirst: "Draw something on the pad first ✏️",
  tooSmall: "Too small — please draw a bit bigger",
  tooFaint: "Too faint — please draw a bit more",
  hideSuccess: "🎉 Hidden! Hope nobody finds it",
  uploadFailed: (msg) => `Upload failed: ${msg}`,
  networkError: "Upload failed due to a network error",
  tooFast: "Slow down! You're clicking too fast",

  emptyTitle: "No drawings hidden yet",
  emptyDesc: "Hide the first one using the drawing pad below!",

  helpTitle: "How to Play",
  helpSteps: [
    { title: "Explore the giant canvas", body: "Drag to move around and zoom in and out to inspect every corner." },
    {
      title: "Find hidden drawings",
      body: "Other players have hidden small drawings all over the canvas. The thumbnails in the left list are your hints.",
    },
    { title: "Found means gone", body: "Once a drawing is found, it is marked as discovered for everyone and disappears from the canvas and the list." },
    {
      title: "Hide your own drawing",
      body: "Draw on the pad below and press Upload. Drag it to a hiding spot, press Complete, and it becomes a new hidden drawing for others to find.",
    },
    {
      title: "Climb the ranking",
      body: "The longer a drawing stays unfound, the higher it ranks. Hide something nobody can find and set a record.",
    },
  ],
  cautionsTitle: "📌 Rules",
  cautions: [
    "Draw at a size and clarity that others can reasonably find.",
    "Drawings that are too faint or unidentifiable may be removed.",
    "Inappropriate content (profanity, explicit or hateful imagery) will be removed.",
    "Moderators may remove drawings according to the operating policy.",
  ],
  tipLabel: "💡 Tip",
  tip: "The canvas is AI-generated, so some animals and objects may look a little unusual. Consider the quirks part of the fun!",

  historyNav: "History",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 Longest-Hidden Drawings of All Time",
  historySubtitle: "The drawings that survived the longest before being found. Still-hidden drawings are included.",
  searchPlaceholder: "Search by nickname…",
  clearSearch: "Clear",
  filterAll: "All",
  filterHidden: "Hidden",
  filterFound: "Found",
  totalRecords: (n) => `${n} record${n === 1 ? "" : "s"} total`,
  searchResults: (q, n) => `${n} result${n === 1 ? "" : "s"} for "${q}"`,
  colRank: "Rank",
  colNickname: "Nickname",
  colHiddenDate: "Hidden on",
  colResult: "Result",
  colDuration: "Time hidden",
  stFound: "Found",
  stHidden: "🤫 Still hidden",
  hiddenOnDate: (date) => `Hidden ${date}`,
  foundOnDate: (date) => `Found ${date}`,
  stillHidden: "Still hidden 🤫",
  noResultsTitle: "No results",
  noResultsDesc: (q) => `No drawings hidden by "${q}"`,
  noRecordsTitle: "No records yet",
  noRecordsDesc: "Be the first one on the board!",
};

const ja: Dict = {
  remainCount: (n) => `${n}個かくれんぼ中`,
  helpButton: "遊び方と注意事項",
  backToCanvas: "キャンバスに戻る",
  close: "閉じる",

  justHidden: "たった今隠されました",
  hiddenForDays: (d) => `${d}日間隠れています`,
  hiddenForHours: (h) => `${h}時間隠れています`,
  badgeNew: "NEW",
  badgeDays: (d) => `${d}日`,
  badgeHours: (h) => `${h}時間`,
  foundAfter: (label) => ` · ${label}で発見`,
  durDays: (d, h) => (h >= 1 ? `${d}日${h}時間` : `${d}日`),
  durHours: (h) => `${h}時間`,
  durUnderHour: "1時間未満",

  myDrawing: "自分の絵",


  rankingTitle: "🏆 隠れた絵 Top 10",
  rankingPill: "ランキング",
  rankingEmpty: "まだランキングがありません",
  rankingHistoryLink: "過去の記録 — 長く生き残った絵",
  rankingCollapse: "ランキングを隠す",
  rankingExpand: "ランキングを表示",

  foundBanner: (nickname) => `🔍 Found! · ${nickname}さんの絵`,

  draw: "お絵かき",
  drawHint: "絵を描いてキャンバスのどこかに隠しましょう",
  collapsePanel: "パネルをたたむ",
  openPanel: "開く",
  toolPen: "ペン",
  toolFill: "塗りつぶし",
  toolEraser: "消しゴム",
  pickColor: "好きな色を選ぶ",
  pickFromScreen: "画面から色を取得",
  brush: "太さ",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "キャンバス上のサイズ",
  minimapTitle: "絵がキャンバスで占めるサイズ（デフォルト基準）",
  upload: "Upload",

  stepBadge: "STEP 2 / 2",
  stepTitle: "位置 · サイズ · ニックネーム",
  stepDesc: "絵をドラッグして隠す場所を決め、サイズを調整してください。キャンバスは引き続き移動・拡大できます。",
  nickname: "ニックネーム",
  nicknamePlaceholder: "あなたの名前",
  size: "サイズ",
  cancel: "キャンセル",
  complete: "Complete",
  submitting: "隠しています…",

  drawFirst: "まずパッドに絵を描いてください ✏️",
  tooSmall: "絵が小さすぎます — もう少し大きく描いてください",
  tooFaint: "絵が薄すぎます — もう少し描いてください",
  hideSuccess: "🎉 隠しました！誰にも見つかりませんように",
  uploadFailed: (msg) => `アップロード失敗: ${msg}`,
  networkError: "ネットワークエラーでアップロードに失敗しました",
  tooFast: "少しゆっくり！クリックが速すぎます",

  emptyTitle: "まだ隠された絵がありません",
  emptyDesc: "下のお絵かきパッドで最初の絵を隠してみましょう！",

  helpTitle: "遊び方",
  helpSteps: [
    { title: "巨大なキャンバスを探検", body: "ドラッグで移動し、拡大・縮小しながら隅々まで探索できます。" },
    {
      title: "隠された絵を探す",
      body: "他のプレイヤーがキャンバスのあちこちに小さな絵を隠しています。左のリストのサムネイルがヒントです。",
    },
    { title: "発見されると消える", body: "見つかった絵は全員に発見済みとして処理され、キャンバスとリストから消えます。" },
    {
      title: "自分の絵を隠す",
      body: "下のパッドに絵を描いて Upload を押します。好きな場所にドラッグして配置し Complete を押すと、新しい隠し絵として登録されます。",
    },
    {
      title: "ランキングに挑戦",
      body: "長く見つからない絵ほどランキング上位に残ります。誰にも見つからない絵を隠して最高記録に挑戦しましょう。",
    },
  ],
  cautionsTitle: "📌 注意事項",
  cautions: [
    "他の人が見つけられる程度の大きさと鮮明さで描いてください。",
    "薄すぎたり識別が難しい絵は削除されることがあります。",
    "暴言・わいせつ・ヘイト表現など不適切なコンテンツは削除対象です。",
    "運営ポリシーに従い、管理者が絵を削除する場合があります。",
  ],
  tipLabel: "💡 Tip",
  tip: "AIで生成したキャンバスのため、一部の動物や物の形が少し独特な場合があります。その違和感もかくし絵探しの楽しみとしてお楽しみください。",

  historyNav: "ヒストリー",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 歴代最長かくれんぼの絵",
  historySubtitle: "発見されるまで最も長く生き残った絵たち。まだ隠れている絵も含まれます。",
  searchPlaceholder: "ニックネームで検索…",
  clearSearch: "クリア",
  filterAll: "すべて",
  filterHidden: "隠れ中",
  filterFound: "発見済み",
  totalRecords: (n) => `全${n}件の記録`,
  searchResults: (q, n) => `"${q}" の検索結果 ${n}件`,
  colRank: "順位",
  colNickname: "ニックネーム",
  colHiddenDate: "隠した日",
  colResult: "結果",
  colDuration: "隠れた時間",
  stFound: "発見済み",
  stHidden: "🤫 まだ隠れ中",
  hiddenOnDate: (date) => `${date} 隠す`,
  foundOnDate: (date) => `${date} 発見`,
  stillHidden: "まだ隠れ中 🤫",
  noResultsTitle: "検索結果がありません",
  noResultsDesc: (q) => `"${q}" が隠した絵は見つかりませんでした`,
  noRecordsTitle: "まだ記録がありません",
  noRecordsDesc: "最初の記録の主人公になりましょう！",
};

const zh: Dict = {
  remainCount: (n) => `${n}个隐藏中`,
  helpButton: "玩法与注意事项",
  backToCanvas: "返回画布",
  close: "关闭",

  justHidden: "刚刚藏好",
  hiddenForDays: (d) => `已隐藏${d}天`,
  hiddenForHours: (h) => `已隐藏${h}小时`,
  badgeNew: "NEW",
  badgeDays: (d) => `${d}天`,
  badgeHours: (h) => `${h}小时`,
  foundAfter: (label) => ` · 藏了${label}后被发现`,
  durDays: (d, h) => (h >= 1 ? `${d}天${h}小时` : `${d}天`),
  durHours: (h) => `${h}小时`,
  durUnderHour: "不到1小时",

  myDrawing: "我的画",


  rankingTitle: "🏆 隐藏绘画 Top 10",
  rankingPill: "排行榜",
  rankingEmpty: "暂无排行",
  rankingHistoryLink: "历史记录 — 坚持最久的画",
  rankingCollapse: "隐藏排行榜",
  rankingExpand: "显示排行榜",

  foundBanner: (nickname) => `🔍 Found! · ${nickname}的画`,

  draw: "画画",
  drawHint: "画一幅画，把它藏在画布的某个角落",
  collapsePanel: "收起面板",
  openPanel: "打开",
  toolPen: "画笔",
  toolFill: "填充",
  toolEraser: "橡皮擦",
  pickColor: "自选颜色",
  pickFromScreen: "从屏幕取色",
  brush: "粗细",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "在画布上的大小",
  minimapTitle: "你的画在画布上所占的大小（默认值）",
  upload: "Upload",

  stepBadge: "STEP 2 / 2",
  stepTitle: "位置 · 大小 · 昵称",
  stepDesc: "拖动画作选择隐藏位置并调整大小。画布仍可移动和缩放。",
  nickname: "昵称",
  nicknamePlaceholder: "你的名字",
  size: "大小",
  cancel: "取消",
  complete: "Complete",
  submitting: "隐藏中…",

  drawFirst: "请先在画板上画点什么 ✏️",
  tooSmall: "画太小了 — 请画大一点",
  tooFaint: "画太淡了 — 请再多画一些",
  hideSuccess: "🎉 藏好了！希望没人找到它",
  uploadFailed: (msg) => `上传失败: ${msg}`,
  networkError: "网络错误，上传失败",
  tooFast: "慢一点！点击太快了",

  emptyTitle: "还没有隐藏的画",
  emptyDesc: "用下方的画板藏下第一幅画吧！",

  helpTitle: "玩法说明",
  helpSteps: [
    { title: "探索巨大画布", body: "拖动移动视角，缩放查看每个角落。" },
    {
      title: "寻找隐藏的画",
      body: "其他玩家在画布各处藏了小画。左侧列表的缩略图就是提示。",
    },
    { title: "被发现即消失", body: "被找到的画将对所有人标记为已发现，并从画布和列表中消失。" },
    {
      title: "隐藏自己的画",
      body: "在下方画板作画后点击 Upload。拖到想藏的位置，点击 Complete，即可注册为新的隐藏画作。",
    },
    {
      title: "挑战排行榜",
      body: "越久没被发现的画排名越高。藏一幅谁也找不到的画，挑战最高纪录吧。",
    },
  ],
  cautionsTitle: "📌 注意事项",
  cautions: [
    "请以他人能够找到的大小和清晰度作画。",
    "过于模糊或难以辨认的画可能会被删除。",
    "辱骂、色情、仇恨等不当内容将被删除。",
    "管理员可根据运营政策删除画作。",
  ],
  tipLabel: "💡 Tip",
  tip: "画布由 AI 生成，部分动物或物体的形态可能略显奇特。请把这些小瑕疵也当作找图游戏的乐趣！",

  historyNav: "历史",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 历代隐藏最久的画",
  historySubtitle: "在被发现前坚持最久的画作，包括仍在隐藏中的画。",
  searchPlaceholder: "按昵称搜索…",
  clearSearch: "清除",
  filterAll: "全部",
  filterHidden: "隐藏中",
  filterFound: "已发现",
  totalRecords: (n) => `共${n}条记录`,
  searchResults: (q, n) => `"${q}" 的搜索结果 ${n}条`,
  colRank: "排名",
  colNickname: "昵称",
  colHiddenDate: "隐藏日期",
  colResult: "结果",
  colDuration: "隐藏时长",
  stFound: "已发现",
  stHidden: "🤫 仍在隐藏",
  hiddenOnDate: (date) => `${date} 隐藏`,
  foundOnDate: (date) => `${date} 发现`,
  stillHidden: "仍在隐藏 🤫",
  noResultsTitle: "没有搜索结果",
  noResultsDesc: (q) => `没有找到 "${q}" 隐藏的画`,
  noRecordsTitle: "暂无记录",
  noRecordsDesc: "成为第一个上榜的人吧！",
};

const es: Dict = {
  remainCount: (n) => `${n} escondidos`,
  helpButton: "Cómo jugar y normas",
  backToCanvas: "Volver al lienzo",
  close: "Cerrar",

  justHidden: "Recién escondido",
  hiddenForDays: (d) => `Escondido hace ${d} día${d === 1 ? "" : "s"}`,
  hiddenForHours: (h) => `Escondido hace ${h} hora${h === 1 ? "" : "s"}`,
  badgeNew: "NEW",
  badgeDays: (d) => `${d}d`,
  badgeHours: (h) => `${h}h`,
  foundAfter: (label) => ` · encontrado tras ${label}`,
  durDays: (d, h) => (h >= 1 ? `${d}d ${h}h` : `${d}d`),
  durHours: (h) => `${h}h`,
  durUnderHour: "< 1 hora",

  myDrawing: "Mío",


  rankingTitle: "🏆 Top 10 de dibujos ocultos",
  rankingPill: "Ranking",
  rankingEmpty: "Aún no hay ranking",
  rankingHistoryLink: "Historial — los que más resistieron",
  rankingCollapse: "Ocultar ranking",
  rankingExpand: "Mostrar ranking",

  foundBanner: (nickname) => `🔍 Found! · dibujo de ${nickname}`,

  draw: "Dibujar",
  drawHint: "Dibuja algo y escóndelo en algún lugar del lienzo",
  collapsePanel: "Plegar panel",
  openPanel: "Abrir",
  toolPen: "Lápiz",
  toolFill: "Rellenar",
  toolEraser: "Borrador",
  pickColor: "Elegir color personalizado",
  pickFromScreen: "Tomar color de la pantalla",
  brush: "Grosor",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "Tamaño en el lienzo",
  minimapTitle: "Tamaño de tu dibujo en el lienzo (por defecto)",
  upload: "Upload",

  stepBadge: "PASO 2 / 2",
  stepTitle: "Posición · Tamaño · Apodo",
  stepDesc: "Arrastra el dibujo para elegir dónde esconderlo y ajusta su tamaño. Puedes seguir moviendo y ampliando el lienzo.",
  nickname: "Apodo",
  nicknamePlaceholder: "Tu nombre",
  size: "Tamaño",
  cancel: "Cancelar",
  complete: "Complete",
  submitting: "Escondiendo…",

  drawFirst: "Primero dibuja algo en el panel ✏️",
  tooSmall: "Demasiado pequeño — dibuja un poco más grande",
  tooFaint: "Demasiado tenue — dibuja un poco más",
  hideSuccess: "🎉 ¡Escondido! Ojalá nadie lo encuentre",
  uploadFailed: (msg) => `Error al subir: ${msg}`,
  networkError: "Error de red al subir",
  tooFast: "¡Más despacio! Haces clic demasiado rápido",

  emptyTitle: "Aún no hay dibujos escondidos",
  emptyDesc: "¡Esconde el primero con el panel de dibujo!",

  helpTitle: "Cómo jugar",
  helpSteps: [
    { title: "Explora el lienzo gigante", body: "Arrastra para moverte y usa el zoom para inspeccionar cada rincón." },
    {
      title: "Encuentra dibujos ocultos",
      body: "Otros jugadores han escondido pequeños dibujos por todo el lienzo. Las miniaturas de la lista izquierda son tus pistas.",
    },
    { title: "Encontrado, eliminado", body: "Cuando un dibujo es encontrado, se marca como descubierto para todos y desaparece del lienzo y de la lista." },
    {
      title: "Esconde tu propio dibujo",
      body: "Dibuja en el panel inferior y pulsa Upload. Arrástralo a su escondite, pulsa Complete y se registrará como nuevo dibujo oculto.",
    },
    {
      title: "Sube en el ranking",
      body: "Cuanto más tiempo pase sin ser encontrado, más alto estará en el ranking. Esconde algo que nadie encuentre y bate el récord.",
    },
  ],
  cautionsTitle: "📌 Normas",
  cautions: [
    "Dibuja con un tamaño y claridad que otros puedan encontrar razonablemente.",
    "Los dibujos demasiado tenues o irreconocibles pueden ser eliminados.",
    "El contenido inapropiado (insultos, contenido explícito u odioso) será eliminado.",
    "Los moderadores pueden eliminar dibujos según la política del servicio.",
  ],
  tipLabel: "💡 Tip",
  tip: "El lienzo está generado por IA, así que algunos animales u objetos pueden verse algo peculiares. ¡Considera esas rarezas parte de la diversión!",

  historyNav: "Historial",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 Los dibujos más tiempo escondidos",
  historySubtitle: "Los dibujos que más resistieron antes de ser encontrados. Incluye los que siguen ocultos.",
  searchPlaceholder: "Buscar por apodo…",
  clearSearch: "Borrar",
  filterAll: "Todos",
  filterHidden: "Ocultos",
  filterFound: "Encontrados",
  totalRecords: (n) => `${n} registro${n === 1 ? "" : "s"} en total`,
  searchResults: (q, n) => `${n} resultado${n === 1 ? "" : "s"} para "${q}"`,
  colRank: "Puesto",
  colNickname: "Apodo",
  colHiddenDate: "Escondido el",
  colResult: "Resultado",
  colDuration: "Tiempo oculto",
  stFound: "Encontrado",
  stHidden: "🤫 Sigue oculto",
  hiddenOnDate: (date) => `Escondido ${date}`,
  foundOnDate: (date) => `Encontrado ${date}`,
  stillHidden: "Sigue oculto 🤫",
  noResultsTitle: "Sin resultados",
  noResultsDesc: (q) => `No hay dibujos escondidos por "${q}"`,
  noRecordsTitle: "Aún no hay registros",
  noRecordsDesc: "¡Sé el primero en la lista!",
};

const fr: Dict = {
  remainCount: (n) => `${n} caché${n === 1 ? "" : "s"}`,
  helpButton: "Comment jouer et règles",
  backToCanvas: "Retour à la toile",
  close: "Fermer",

  justHidden: "Tout juste caché",
  hiddenForDays: (d) => `Caché depuis ${d} jour${d === 1 ? "" : "s"}`,
  hiddenForHours: (h) => `Caché depuis ${h} heure${h === 1 ? "" : "s"}`,
  badgeNew: "NEW",
  badgeDays: (d) => `${d}j`,
  badgeHours: (h) => `${h}h`,
  foundAfter: (label) => ` · trouvé après ${label}`,
  durDays: (d, h) => (h >= 1 ? `${d}j ${h}h` : `${d}j`),
  durHours: (h) => `${h}h`,
  durUnderHour: "< 1 heure",

  myDrawing: "À moi",


  rankingTitle: "🏆 Top 10 des dessins cachés",
  rankingPill: "Classement",
  rankingEmpty: "Pas encore de classement",
  rankingHistoryLink: "Historique — les plus résistants",
  rankingCollapse: "Masquer le classement",
  rankingExpand: "Afficher le classement",

  foundBanner: (nickname) => `🔍 Found! · dessin de ${nickname}`,

  draw: "Dessiner",
  drawHint: "Dessinez quelque chose et cachez-le quelque part sur la toile",
  collapsePanel: "Replier le panneau",
  openPanel: "Ouvrir",
  toolPen: "Crayon",
  toolFill: "Remplir",
  toolEraser: "Gomme",
  pickColor: "Choisir une couleur",
  pickFromScreen: "Prélever une couleur à l'écran",
  brush: "Épaisseur",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "Taille sur la toile",
  minimapTitle: "Taille de votre dessin sur la toile (par défaut)",
  upload: "Upload",

  stepBadge: "ÉTAPE 2 / 2",
  stepTitle: "Position · Taille · Pseudo",
  stepDesc: "Faites glisser le dessin pour choisir sa cachette et ajustez sa taille. Vous pouvez toujours déplacer et zoomer la toile.",
  nickname: "Pseudo",
  nicknamePlaceholder: "Votre nom",
  size: "Taille",
  cancel: "Annuler",
  complete: "Complete",
  submitting: "En cours…",

  drawFirst: "Dessinez d'abord quelque chose ✏️",
  tooSmall: "Trop petit — dessinez un peu plus grand",
  tooFaint: "Trop pâle — dessinez un peu plus",
  hideSuccess: "🎉 Caché ! Pourvu que personne ne le trouve",
  uploadFailed: (msg) => `Échec de l'envoi : ${msg}`,
  networkError: "Échec de l'envoi (erreur réseau)",
  tooFast: "Doucement ! Vous cliquez trop vite",

  emptyTitle: "Aucun dessin caché pour l'instant",
  emptyDesc: "Cachez le premier avec le panneau de dessin !",

  helpTitle: "Comment jouer",
  helpSteps: [
    { title: "Explorez la toile géante", body: "Faites glisser pour vous déplacer et zoomez pour inspecter chaque recoin." },
    {
      title: "Trouvez les dessins cachés",
      body: "D'autres joueurs ont caché de petits dessins partout sur la toile. Les vignettes de la liste de gauche sont vos indices.",
    },
    { title: "Trouvé, disparu", body: "Un dessin trouvé est marqué comme découvert pour tous et disparaît de la toile et de la liste." },
    {
      title: "Cachez votre propre dessin",
      body: "Dessinez sur le panneau du bas puis appuyez sur Upload. Glissez-le vers sa cachette, appuyez sur Complete : il devient un nouveau dessin à trouver.",
    },
    {
      title: "Grimpez au classement",
      body: "Plus un dessin reste introuvable longtemps, plus il monte au classement. Cachez l'introuvable et battez le record.",
    },
  ],
  cautionsTitle: "📌 Règles",
  cautions: [
    "Dessinez à une taille et une netteté raisonnablement trouvables par les autres.",
    "Les dessins trop pâles ou méconnaissables peuvent être supprimés.",
    "Tout contenu inapproprié (injures, contenu explicite ou haineux) sera supprimé.",
    "Les modérateurs peuvent supprimer des dessins conformément à la politique du service.",
  ],
  tipLabel: "💡 Astuce",
  tip: "La toile est générée par IA : certains animaux ou objets peuvent sembler un peu étranges. Considérez ces bizarreries comme faisant partie du jeu !",

  historyNav: "Historique",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 Les dessins cachés le plus longtemps",
  historySubtitle: "Les dessins qui ont résisté le plus longtemps avant d'être trouvés. Les dessins encore cachés sont inclus.",
  searchPlaceholder: "Rechercher par pseudo…",
  clearSearch: "Effacer",
  filterAll: "Tous",
  filterHidden: "Cachés",
  filterFound: "Trouvés",
  totalRecords: (n) => `${n} enregistrement${n === 1 ? "" : "s"} au total`,
  searchResults: (q, n) => `${n} résultat${n === 1 ? "" : "s"} pour « ${q} »`,
  colRank: "Rang",
  colNickname: "Pseudo",
  colHiddenDate: "Caché le",
  colResult: "Résultat",
  colDuration: "Durée cachée",
  stFound: "Trouvé",
  stHidden: "🤫 Encore caché",
  hiddenOnDate: (date) => `Caché le ${date}`,
  foundOnDate: (date) => `Trouvé le ${date}`,
  stillHidden: "Encore caché 🤫",
  noResultsTitle: "Aucun résultat",
  noResultsDesc: (q) => `Aucun dessin caché par « ${q} »`,
  noRecordsTitle: "Pas encore d'enregistrements",
  noRecordsDesc: "Soyez le premier au tableau !",
};

const de: Dict = {
  remainCount: (n) => `${n} versteckt`,
  helpButton: "Spielanleitung & Regeln",
  backToCanvas: "Zurück zur Leinwand",
  close: "Schließen",

  justHidden: "Gerade versteckt",
  hiddenForDays: (d) => `Seit ${d} Tag${d === 1 ? "" : "en"} versteckt`,
  hiddenForHours: (h) => `Seit ${h} Stunde${h === 1 ? "" : "n"} versteckt`,
  badgeNew: "NEU",
  badgeDays: (d) => `${d} T.`,
  badgeHours: (h) => `${h} Std.`,
  foundAfter: (label) => ` · nach ${label} gefunden`,
  durDays: (d, h) => (h >= 1 ? `${d} T. ${h} Std.` : `${d} T.`),
  durHours: (h) => `${h} Std.`,
  durUnderHour: "< 1 Stunde",

  myDrawing: "Meins",


  rankingTitle: "🏆 Top 10 versteckte Bilder",
  rankingPill: "Rangliste",
  rankingEmpty: "Noch keine Rangliste",
  rankingHistoryLink: "Vergangene Rekorde — die Ausdauerndsten",
  rankingCollapse: "Rangliste ausblenden",
  rankingExpand: "Rangliste anzeigen",

  foundBanner: (nickname) => `🔍 Found! · Bild von ${nickname}`,

  draw: "Zeichnen",
  drawHint: "Zeichne etwas und verstecke es irgendwo auf der Leinwand",
  collapsePanel: "Panel einklappen",
  openPanel: "Öffnen",
  toolPen: "Stift",
  toolFill: "Füllen",
  toolEraser: "Radierer",
  pickColor: "Eigene Farbe wählen",
  pickFromScreen: "Farbe vom Bildschirm aufnehmen",
  brush: "Stärke",
  clear: "Clear",
  undo: "Undo",
  redo: "Redo",
  minimapLabel: "Größe auf der Leinwand",
  minimapTitle: "So groß erscheint deine Zeichnung auf der Leinwand (Standard)",
  upload: "Upload",

  stepBadge: "SCHRITT 2 / 2",
  stepTitle: "Position · Größe · Spitzname",
  stepDesc: "Ziehe die Zeichnung an ihr Versteck und passe die Größe an. Die Leinwand lässt sich weiterhin bewegen und zoomen.",
  nickname: "Spitzname",
  nicknamePlaceholder: "Dein Name",
  size: "Größe",
  cancel: "Abbrechen",
  complete: "Complete",
  submitting: "Wird versteckt…",

  drawFirst: "Zeichne zuerst etwas auf dem Pad ✏️",
  tooSmall: "Zu klein — bitte etwas größer zeichnen",
  tooFaint: "Zu blass — bitte etwas mehr zeichnen",
  hideSuccess: "🎉 Versteckt! Hoffentlich findet es niemand",
  uploadFailed: (msg) => `Upload fehlgeschlagen: ${msg}`,
  networkError: "Upload wegen Netzwerkfehler fehlgeschlagen",
  tooFast: "Langsam! Du klickst zu schnell",

  emptyTitle: "Noch keine versteckten Bilder",
  emptyDesc: "Verstecke das erste mit dem Zeichenpad unten!",

  helpTitle: "Spielanleitung",
  helpSteps: [
    { title: "Erkunde die riesige Leinwand", body: "Ziehe zum Bewegen und zoome hinein und heraus, um jeden Winkel zu untersuchen." },
    {
      title: "Finde versteckte Bilder",
      body: "Andere Spieler haben überall auf der Leinwand kleine Bilder versteckt. Die Vorschaubilder in der linken Liste sind deine Hinweise.",
    },
    { title: "Gefunden heißt weg", body: "Ein gefundenes Bild gilt für alle als entdeckt und verschwindet von der Leinwand und aus der Liste." },
    {
      title: "Verstecke dein eigenes Bild",
      body: "Zeichne auf dem Pad unten und drücke Upload. Ziehe es an sein Versteck, drücke Complete — schon ist es ein neues Suchbild für andere.",
    },
    {
      title: "Erklimme die Rangliste",
      body: "Je länger ein Bild unentdeckt bleibt, desto höher steht es. Verstecke etwas Unauffindbares und stelle einen Rekord auf.",
    },
  ],
  cautionsTitle: "📌 Regeln",
  cautions: [
    "Zeichne in einer Größe und Deutlichkeit, die andere realistisch finden können.",
    "Zu blasse oder unkenntliche Bilder können entfernt werden.",
    "Unangemessene Inhalte (Beleidigungen, explizite oder hasserfüllte Darstellungen) werden entfernt.",
    "Moderatoren können Bilder gemäß den Betriebsrichtlinien entfernen.",
  ],
  tipLabel: "💡 Tipp",
  tip: "Die Leinwand ist KI-generiert — manche Tiere oder Objekte sehen etwas eigenwillig aus. Betrachte diese Eigenheiten als Teil des Spaßes!",

  historyNav: "Verlauf",
  hallOfFame: "Hall of Fame",
  historyTitle: "🏆 Die am längsten versteckten Bilder",
  historySubtitle: "Die Bilder, die am längsten durchgehalten haben. Noch versteckte Bilder sind enthalten.",
  searchPlaceholder: "Nach Spitzname suchen…",
  clearSearch: "Löschen",
  filterAll: "Alle",
  filterHidden: "Versteckt",
  filterFound: "Gefunden",
  totalRecords: (n) => `Insgesamt ${n} Einträge`,
  searchResults: (q, n) => `${n} Treffer für „${q}"`,
  colRank: "Rang",
  colNickname: "Spitzname",
  colHiddenDate: "Versteckt am",
  colResult: "Ergebnis",
  colDuration: "Verborgen für",
  stFound: "Gefunden",
  stHidden: "🤫 Noch versteckt",
  hiddenOnDate: (date) => `Versteckt am ${date}`,
  foundOnDate: (date) => `Gefunden am ${date}`,
  stillHidden: "Noch versteckt 🤫",
  noResultsTitle: "Keine Treffer",
  noResultsDesc: (q) => `Keine Bilder von „${q}" gefunden`,
  noRecordsTitle: "Noch keine Einträge",
  noRecordsDesc: "Sei der Erste auf der Tafel!",
};

const DICTS: Record<Lang, Dict> = { ko, en, ja, zh, es, fr, de };

/** 브라우저 언어 설정 기반 자동 감지 — 수동 선택 UI 없음 */
function detectLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "ko";
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("de")) return "de";
  return "en";
}

const LangCtx = createContext<{ lang: Lang; t: Dict }>({
  lang: "ko",
  t: ko,
});

export function LangProvider({ children }: { children: ReactNode }) {
  // SSR과 첫 클라이언트 렌더의 불일치를 피하기 위해 마운트 후 감지
  const [lang, setLang] = useState<Lang>("ko");
  useEffect(() => {
    setLang(detectLang());
  }, []);
  return <LangCtx.Provider value={{ lang, t: DICTS[lang] }}>{children}</LangCtx.Provider>;
}

export const useI18n = () => useContext(LangCtx);
