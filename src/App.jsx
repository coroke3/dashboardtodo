import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Play,
  Tag,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  ListTodo,
  Calendar,
  Plus,
  X,
  History,
  Target,
  TrendingUp,
  BarChart3,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Search,
  Layers,
  PieChart,
  Settings,
  Flame,
  Clock,
  Inbox,
  CheckSquare,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  Sparkles,
  RotateCcw,
} from "lucide-react";

const today = new Date();
const threeDaysAgo = new Date(today);
threeDaysAgo.setDate(today.getDate() - 3);
const tenDaysAgo = new Date(today);
tenDaysAgo.setDate(today.getDate() - 10);
const twentyDaysAgo = new Date(today);
twentyDaysAgo.setDate(today.getDate() - 20);
const thirtyFiveDaysAgo = new Date(today);
thirtyFiveDaysAgo.setDate(today.getDate() - 35);

const iso = (d) => d.toISOString();

const MOCK_TASKS = [
  {
    id: "1",
    listId: "demo",
    title: "[univ][rpt] ソフトウェア工学 中間レポート作成",
    status: "needsAction",
    due: iso(new Date(today.getTime() + 5 * 86400000)),
  },
  {
    id: "2",
    listId: "demo",
    title: "[private] スーパーで夕食の買い出し",
    status: "needsAction",
    due: iso(new Date(today.getTime() + 86400000)),
  },
  {
    id: "3",
    listId: "demo",
    title: "[univ][lit] HCI関連の論文を3本読む",
    status: "completed",
    due: iso(threeDaysAgo),
    completed: iso(threeDaysAgo),
  },
  {
    id: "4",
    listId: "demo",
    title: "部屋の掃除とゴミ出し",
    status: "needsAction",
  },
  {
    id: "5",
    listId: "demo",
    title: "[rpt] アルバイトのシフト希望提出",
    status: "needsAction",
    due: iso(new Date(today.getTime() + 2 * 86400000)),
  },
  {
    id: "6",
    listId: "demo",
    title: "[univ][private] 友人との勉強会",
    status: "needsAction",
  },
  {
    id: "7",
    listId: "demo",
    title: "[lit] 新刊の技術書を読む",
    status: "completed",
    due: iso(tenDaysAgo),
    completed: iso(tenDaysAgo),
  },
  {
    id: "8",
    listId: "demo",
    title: "[univ] 授業の履修登録",
    status: "completed",
    due: iso(today),
    completed: iso(today),
  },
  {
    id: "9",
    listId: "demo",
    title: "[rpt] 先月の月次レポート提出",
    status: "completed",
    due: iso(twentyDaysAgo),
    completed: iso(twentyDaysAgo),
  },
  {
    id: "10",
    listId: "demo",
    title: "[univ] 数学演習",
    status: "completed",
    due: iso(thirtyFiveDaysAgo),
    completed: iso(thirtyFiveDaysAgo),
  },
  {
    id: "11",
    listId: "demo",
    title: "[univ] moodle で課題 Canvas 確認",
    status: "needsAction",
    due: iso(new Date(today.getTime() + 3 * 86400000)),
  },
];

const SCOPES = "https://www.googleapis.com/auth/tasks";
const FETCH_MAX_RESULTS = 999;

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

const GOOGLE_TASKS_OAUTH_STORAGE_KEY = "google_tasks_oauth_v1";
const OAUTH_EXPIRY_SKEW_MS = 60_000;

const readStoredOAuth = (clientId) => {
  if (!clientId) return null;
  try {
    const raw = localStorage.getItem(GOOGLE_TASKS_OAUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (data.clientId !== clientId) return null;
    if (
      typeof data.accessToken !== "string" ||
      typeof data.expiresAt !== "number"
    )
      return null;
    return data;
  } catch {
    return null;
  }
};

const writeStoredOAuth = (clientId, accessToken, expiresInSec) => {
  const sec =
    typeof expiresInSec === "number" && expiresInSec > 0 ? expiresInSec : 3600;
  const expiresAt = Date.now() + sec * 1000 - OAUTH_EXPIRY_SKEW_MS;
  localStorage.setItem(
    GOOGLE_TASKS_OAUTH_STORAGE_KEY,
    JSON.stringify({ clientId, accessToken, expiresAt })
  );
};

const clearStoredOAuth = () => {
  localStorage.removeItem(GOOGLE_TASKS_OAUTH_STORAGE_KEY);
};

const effectiveClientId = () =>
  (
    localStorage.getItem("google_tasks_client_id") ||
    ENV_CLIENT_ID ||
    ""
  ).trim();

// === 翻訳辞書 (3段階の言語/演出モード) ===
const I18N = {
  active: { ja: "アクティブ", en_mix: "Active", en: "Active Tasks" },
  history: { ja: "履歴", en_mix: "History", en: "History" },
  calendar: { ja: "カレンダー", en_mix: "Calendar", en: "Calendar" },
  analytics: { ja: "分析ダッシュボード", en_mix: "Analytics", en: "Analytics" },
  routines: { ja: "ルーチン検出", en_mix: "Routines", en: "Routines" },
  tags: { ja: "タグ管理", en_mix: "Tags", en: "Tags" },
  replace: { ja: "タスク一括置換", en_mix: "Replace", en: "Batch Replace" },
  settings: { ja: "UI設定", en_mix: "UI Settings", en: "Settings" },
  organize: { ja: "整理", en_mix: "Organize", en: "Organize" },
  settingsUi: { ja: "デザイン", en_mix: "Design", en: "Design" },
  settingsReplace: { ja: "一括置換", en_mix: "Replace", en: "Replace" },
  settingsSystem: { ja: "システム", en_mix: "System", en: "System" },
  search: { ja: "検索...", en_mix: "Search...", en: "Search..." },
  refresh: { ja: "更新", en_mix: "Refresh", en: "Refresh" },
  logout: { ja: "切断", en_mix: "Logout", en: "Logout" },
  all: { ja: "すべて", en_mix: "All", en: "All" },
  weeklyProgress: {
    ja: "今週の達成率",
    en_mix: "Weekly Progress",
    en: "Weekly Progress",
  },
  completed: { ja: "完了", en_mix: "Done", en: "Completed" },
  total: { ja: "全体", en_mix: "Total", en: "Total" },
  thisWeek: { ja: "今週", en_mix: "This Wk", en: "This Week" },
  nextWeek: { ja: "来週", en_mix: "Next Wk", en: "Next Week" },
  thisMonth: { ja: "今月", en_mix: "This Mo", en: "This Month" },
  weekAfterNext: {
    ja: "再来週",
    en_mix: "Wk After Next",
    en: "Week After Next",
  },
  nextMonth: { ja: "来月", en_mix: "Next Mo", en: "Next Month" },
  monthAfterNext: {
    ja: "再来月",
    en_mix: "Mo After Next",
    en: "Month After Next",
  },
  lastWeek: { ja: "先週", en_mix: "Last Wk", en: "Last Week" },
  weekBeforeLast: { ja: "先々週", en_mix: "2 Wks Ago", en: "2 Weeks Ago" },
};
const t = (key, lang) => I18N[key]?.[lang] || key;

const THEME_PRESETS = [
  // ─── ブランド・OS (Brand / OS) ───────────────────────────────────────
  {
    id: "101",
    category: "ブランド・OS",
    name: "Cupertino (iOS風)",
    config: {
      bgTheme: "light",
      radius: "lg",
      font: "sans",
      weight: "normal",
      accent: "blue",
      texture: "glass",
      density: "normal",
      animation: "spring",
      mouseEffect: "none",
      shadow: "sm",
      border: "none",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "102",
    category: "ブランド・OS",
    name: "Material You",
    config: {
      bgTheme: "paper",
      radius: "xl",
      font: "rounded",
      weight: "medium",
      accent: "emerald",
      texture: "flat",
      density: "loose",
      animation: "blur",
      mouseEffect: "none",
      shadow: "none",
      border: "none",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "103",
    category: "ブランド・OS",
    name: "Fluent (Windows風)",
    config: {
      bgTheme: "white",
      radius: "sm",
      font: "sans",
      weight: "normal",
      accent: "blue",
      texture: "glass",
      density: "normal",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "104",
    category: "ブランド・OS",
    name: "ChatGPT Dark",
    config: {
      bgTheme: "dark",
      radius: "md",
      font: "sans",
      weight: "normal",
      accent: "emerald",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "none",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "105",
    category: "ブランド・OS",
    name: "Gemini Spark",
    config: {
      bgTheme: "white",
      radius: "xl",
      font: "sans",
      weight: "medium",
      accent: "violet",
      texture: "glass",
      density: "loose",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: true,
    },
  },
  {
    id: "106",
    category: "ブランド・OS",
    name: "Google Workspace",
    config: {
      bgTheme: "white",
      radius: "md",
      font: "sans",
      weight: "medium",
      accent: "blue",
      texture: "flat",
      density: "normal",
      animation: "slide",
      mouseEffect: "none",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "107",
    category: "ブランド・OS",
    name: "Tama Art Info Design",
    config: {
      bgTheme: "white",
      radius: "none",
      font: "zenKakuAntique",
      weight: "black",
      accent: "amber",
      texture: "simple",
      density: "loose",
      animation: "slide",
      mouseEffect: "glow",
      shadow: "none",
      border: "thick",
      iconStyle: "text",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "108",
    category: "ブランド・OS",
    name: "VisionOS",
    config: {
      bgTheme: "gray",
      radius: "xl",
      font: "sans",
      weight: "normal",
      accent: "slate",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "109",
    category: "ブランド・OS",
    name: "Ubuntu",
    config: {
      bgTheme: "dark",
      radius: "md",
      font: "sans",
      weight: "normal",
      accent: "amber",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "110",
    category: "ブランド・OS",
    name: "Nintendo Switch",
    config: {
      bgTheme: "white",
      radius: "xl",
      font: "rounded",
      weight: "bold",
      accent: "rose",
      texture: "flat",
      density: "compact",
      animation: "spring",
      mouseEffect: "none",
      shadow: "none",
      border: "none",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },

  // ─── モノクロ・ミニマル (Monochrome / Minimal) ────────────────────────
  {
    id: "11",
    category: "モノクロ・ミニマル",
    name: "Studio Noir",
    config: {
      bgTheme: "pitchBlack",
      radius: "none",
      font: "sans",
      weight: "light",
      accent: "white",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "12",
    category: "モノクロ・ミニマル",
    name: "Pure White",
    config: {
      bgTheme: "white",
      radius: "none",
      font: "sans",
      weight: "normal",
      accent: "black",
      texture: "flat",
      density: "loose",
      animation: "slide",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "13",
    category: "モノクロ・ミニマル",
    name: "Notion Style",
    config: {
      bgTheme: "white",
      radius: "sm",
      font: "sans",
      weight: "normal",
      accent: "zinc",
      texture: "flat",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "14",
    category: "モノクロ・ミニマル",
    name: "Linear",
    config: {
      bgTheme: "dark",
      radius: "md",
      font: "sans",
      weight: "medium",
      accent: "violet",
      texture: "glass",
      density: "normal",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },
  {
    id: "15",
    category: "モノクロ・ミニマル",
    name: "Bauhaus",
    config: {
      bgTheme: "paper",
      radius: "none",
      font: "sans",
      weight: "black",
      accent: "rose",
      texture: "simple",
      density: "loose",
      animation: "off",
      mouseEffect: "none",
      shadow: "none",
      border: "thick",
      iconStyle: "text",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "16",
    category: "モノクロ・ミニマル",
    name: "Braun Design",
    config: {
      bgTheme: "gray",
      radius: "sm",
      font: "sans",
      weight: "medium",
      accent: "zinc",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "17",
    category: "モノクロ・ミニマル",
    name: "Wireframe",
    config: {
      bgTheme: "white",
      radius: "none",
      font: "mono",
      weight: "normal",
      accent: "black",
      texture: "simple",
      density: "compact",
      animation: "off",
      mouseEffect: "none",
      shadow: "none",
      border: "thick",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "18",
    category: "モノクロ・ミニマル",
    name: "Architect",
    config: {
      bgTheme: "white",
      radius: "none",
      font: "serif",
      weight: "normal",
      accent: "slate",
      texture: "flat",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "text",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "19",
    category: "モノクロ・ミニマル",
    name: "Zen Minimal",
    config: {
      bgTheme: "paper",
      radius: "md",
      font: "zenOld",
      weight: "light",
      accent: "zinc",
      texture: "paper",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "20",
    category: "モノクロ・ミニマル",
    name: "Ghost",
    config: {
      bgTheme: "pitchBlack",
      radius: "lg",
      font: "sans",
      weight: "light",
      accent: "slate",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },

  // ─── 視認性・高コントラスト (Accessibility / High Contrast) ─────────
  {
    id: "21",
    category: "視認性・高コントラスト",
    name: "UD Focus Light",
    config: {
      bgTheme: "light",
      radius: "md",
      font: "bizUD",
      weight: "bold",
      accent: "blue",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "22",
    category: "視認性・高コントラスト",
    name: "UD Focus Dark",
    config: {
      bgTheme: "pitchBlack",
      radius: "md",
      font: "bizUD",
      weight: "bold",
      accent: "amber",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "23",
    category: "視認性・高コントラスト",
    name: "HC Black & Yellow",
    config: {
      bgTheme: "pitchBlack",
      radius: "none",
      font: "bizUD",
      weight: "black",
      accent: "amber",
      texture: "simple",
      density: "loose",
      animation: "off",
      mouseEffect: "none",
      shadow: "none",
      border: "thick",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "24",
    category: "視認性・高コントラスト",
    name: "HC White & Black",
    config: {
      bgTheme: "white",
      radius: "none",
      font: "bizUD",
      weight: "black",
      accent: "black",
      texture: "simple",
      density: "loose",
      animation: "off",
      mouseEffect: "none",
      shadow: "none",
      border: "thick",
      iconStyle: "text",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "25",
    category: "視認性・高コントラスト",
    name: "Dyslexia Friendly",
    config: {
      bgTheme: "cream",
      radius: "md",
      font: "rounded",
      weight: "medium",
      accent: "teal",
      texture: "flat",
      density: "loose",
      animation: "slide",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "26",
    category: "視認性・高コントラスト",
    name: "Terminal HC",
    config: {
      bgTheme: "pitchBlack",
      radius: "none",
      font: "mono",
      weight: "bold",
      accent: "emerald",
      texture: "neon",
      density: "compact",
      animation: "off",
      mouseEffect: "none",
      shadow: "none",
      border: "thick",
      iconStyle: "text",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "27",
    category: "視認性・高コントラスト",
    name: "Reader Mode",
    config: {
      bgTheme: "paper",
      radius: "md",
      font: "serif",
      weight: "medium",
      accent: "black",
      texture: "paper",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "text",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "28",
    category: "視認性・高コントラスト",
    name: "Night Vision",
    config: {
      bgTheme: "pitchBlack",
      radius: "md",
      font: "mono",
      weight: "bold",
      accent: "rose",
      texture: "flat",
      density: "normal",
      animation: "off",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "29",
    category: "視認性・高コントラスト",
    name: "Colorblind Safe",
    config: {
      bgTheme: "white",
      radius: "lg",
      font: "sans",
      weight: "bold",
      accent: "blue",
      texture: "flat",
      density: "loose",
      animation: "slide",
      mouseEffect: "none",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "30",
    category: "視認性・高コントラスト",
    name: "Contrast Blue",
    config: {
      bgTheme: "navy",
      radius: "lg",
      font: "bizUD",
      weight: "bold",
      accent: "cyan",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },

  // ─── ライト・温かみ (Light / Warm) ────────────────────────────────────
  {
    id: "31",
    category: "ライト・温かみ",
    name: "Editorial Serif",
    config: {
      bgTheme: "paper",
      radius: "none",
      font: "shippori",
      weight: "medium",
      accent: "black",
      texture: "paper",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "text",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "32",
    category: "ライト・温かみ",
    name: "Rose Water",
    config: {
      bgTheme: "light",
      radius: "lg",
      font: "shippori",
      weight: "medium",
      accent: "rose",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "sm",
      border: "none",
      iconStyle: "lucide",
      language: "ja",
      useGradient: true,
    },
  },
  {
    id: "33",
    category: "ライト・温かみ",
    name: "Creamy Latte",
    config: {
      bgTheme: "cream",
      radius: "lg",
      font: "rounded",
      weight: "medium",
      accent: "amber",
      texture: "paper",
      density: "loose",
      animation: "blur",
      mouseEffect: "none",
      shadow: "sm",
      border: "none",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "34",
    category: "ライト・温かみ",
    name: "Sakura",
    config: {
      bgTheme: "light",
      radius: "xl",
      font: "shippori",
      weight: "medium",
      accent: "rose",
      texture: "glass",
      density: "loose",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "sm",
      border: "none",
      iconStyle: "lucide",
      language: "ja",
      useGradient: true,
    },
  },
  {
    id: "35",
    category: "ライト・温かみ",
    name: "Apricot",
    config: {
      bgTheme: "cream",
      radius: "md",
      font: "sans",
      weight: "medium",
      accent: "amber",
      texture: "flat",
      density: "normal",
      animation: "slide",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "36",
    category: "ライト・温かみ",
    name: "Cotton",
    config: {
      bgTheme: "white",
      radius: "lg",
      font: "rounded",
      weight: "normal",
      accent: "slate",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "none",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    },
  },
  {
    id: "37",
    category: "ライト・温かみ",
    name: "Peach Puff",
    config: {
      bgTheme: "paper",
      radius: "md",
      font: "rounded",
      weight: "bold",
      accent: "rose",
      texture: "paper",
      density: "loose",
      animation: "spring",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "38",
    category: "ライト・温かみ",
    name: "Honeycomb",
    config: {
      bgTheme: "cream",
      radius: "lg",
      font: "lineSeed",
      weight: "bold",
      accent: "amber",
      texture: "flat",
      density: "normal",
      animation: "slide",
      mouseEffect: "glow",
      shadow: "md",
      border: "none",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "39",
    category: "ライト・温かみ",
    name: "Sunlight",
    config: {
      bgTheme: "light",
      radius: "md",
      font: "sans",
      weight: "medium",
      accent: "amber",
      texture: "glass",
      density: "normal",
      animation: "blur",
      mouseEffect: "none",
      shadow: "md",
      border: "none",
      iconStyle: "lucide",
      language: "ja",
      useGradient: true,
    },
  },
  {
    id: "40",
    category: "ライト・温かみ",
    name: "Cashmere",
    config: {
      bgTheme: "paper",
      radius: "sm",
      font: "serif",
      weight: "light",
      accent: "bronze",
      texture: "paper",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "text",
      language: "en_mix",
      useGradient: false,
    },
  },

  // ─── ダーク・サイバー (Dark / Cyber) ────────────────────────────────────
  {
    id: "41",
    category: "ダーク・サイバー",
    name: "Cyber Neon",
    config: {
      bgTheme: "navy",
      radius: "sm",
      font: "mono",
      weight: "bold",
      accent: "cyan",
      texture: "neon",
      density: "normal",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },
  {
    id: "42",
    category: "ダーク・サイバー",
    name: "Dracula",
    config: {
      bgTheme: "pitchBlack",
      radius: "md",
      font: "mono",
      weight: "normal",
      accent: "violet",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "43",
    category: "ダーク・サイバー",
    name: "Tokyo Night",
    config: {
      bgTheme: "navy",
      radius: "lg",
      font: "sans",
      weight: "medium",
      accent: "cyan",
      texture: "glass",
      density: "normal",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "44",
    category: "ダーク・サイバー",
    name: "Nord",
    config: {
      bgTheme: "dark",
      radius: "md",
      font: "sans",
      weight: "normal",
      accent: "cyan",
      texture: "flat",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "none",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "45",
    category: "ダーク・サイバー",
    name: "Synthwave",
    config: {
      bgTheme: "navy",
      radius: "none",
      font: "mono",
      weight: "black",
      accent: "fuchsia",
      texture: "neon",
      density: "compact",
      animation: "slide",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thick",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },
  {
    id: "46",
    category: "ダーク・サイバー",
    name: "Hacker",
    config: {
      bgTheme: "pitchBlack",
      radius: "none",
      font: "mono",
      weight: "normal",
      accent: "emerald",
      texture: "neon",
      density: "compact",
      animation: "off",
      mouseEffect: "glow",
      shadow: "none",
      border: "thin",
      iconStyle: "text",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "47",
    category: "ダーク・サイバー",
    name: "Outrun",
    config: {
      bgTheme: "pitchBlack",
      radius: "md",
      font: "mono",
      weight: "bold",
      accent: "rose",
      texture: "neon",
      density: "normal",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thick",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },
  {
    id: "48",
    category: "ダーク・サイバー",
    name: "Deep Space",
    config: {
      bgTheme: "pitchBlack",
      radius: "xl",
      font: "sans",
      weight: "medium",
      accent: "violet",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "49",
    category: "ダーク・サイバー",
    name: "System Failure",
    config: {
      bgTheme: "dark",
      radius: "none",
      font: "mono",
      weight: "black",
      accent: "rose",
      texture: "neon",
      density: "compact",
      animation: "slide",
      mouseEffect: "none",
      shadow: "lg",
      border: "thick",
      iconStyle: "text",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "50",
    category: "ダーク・サイバー",
    name: "Cyberpunk 2077",
    config: {
      bgTheme: "dark",
      radius: "none",
      font: "lineSeed",
      weight: "black",
      accent: "amber",
      texture: "flat",
      density: "compact",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "none",
      border: "thick",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },

  // ─── エレガント・リッチ (Elegant / Rich) ──────────────────────────────
  {
    id: "51",
    category: "エレガント・リッチ",
    name: "Glass Morphism",
    config: {
      bgTheme: "dark",
      radius: "lg",
      font: "sans",
      weight: "medium",
      accent: "violet",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "52",
    category: "エレガント・リッチ",
    name: "Aurora Borealis",
    config: {
      bgTheme: "navy",
      radius: "xl",
      font: "sans",
      weight: "medium",
      accent: "emerald",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },
  {
    id: "53",
    category: "エレガント・リッチ",
    name: "Midnight Gold",
    config: {
      bgTheme: "pitchBlack",
      radius: "lg",
      font: "shippori",
      weight: "bold",
      accent: "gold",
      texture: "neon",
      density: "loose",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "text",
      language: "ja",
      useGradient: true,
    },
  },
  {
    id: "54",
    category: "エレガント・リッチ",
    name: "Royal Purple",
    config: {
      bgTheme: "dark",
      radius: "xl",
      font: "serif",
      weight: "medium",
      accent: "violet",
      texture: "glass",
      density: "loose",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "55",
    category: "エレガント・リッチ",
    name: "Pearl",
    config: {
      bgTheme: "white",
      radius: "xl",
      font: "sans",
      weight: "normal",
      accent: "slate",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },
  {
    id: "56",
    category: "エレガント・リッチ",
    name: "Velvet",
    config: {
      bgTheme: "dark",
      radius: "lg",
      font: "serif",
      weight: "medium",
      accent: "rose",
      texture: "paper",
      density: "loose",
      animation: "fade",
      mouseEffect: "none",
      shadow: "lg",
      border: "none",
      iconStyle: "text",
      language: "ja",
      useGradient: false,
    },
  },
  {
    id: "57",
    category: "エレガント・リッチ",
    name: "Platinum",
    config: {
      bgTheme: "gray",
      radius: "lg",
      font: "sans",
      weight: "light",
      accent: "slate",
      texture: "glass",
      density: "normal",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "58",
    category: "エレガント・リッチ",
    name: "Champagne",
    config: {
      bgTheme: "cream",
      radius: "xl",
      font: "shippori",
      weight: "medium",
      accent: "gold",
      texture: "glass",
      density: "loose",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "ja",
      useGradient: true,
    },
  },
  {
    id: "59",
    category: "エレガント・リッチ",
    name: "Ruby",
    config: {
      bgTheme: "pitchBlack",
      radius: "md",
      font: "serif",
      weight: "bold",
      accent: "rose",
      texture: "glass",
      density: "normal",
      animation: "fade",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "text",
      language: "en_mix",
      useGradient: true,
    },
  },
  {
    id: "60",
    category: "エレガント・リッチ",
    name: "Sapphire",
    config: {
      bgTheme: "navy",
      radius: "md",
      font: "sans",
      weight: "medium",
      accent: "cyan",
      texture: "glass",
      density: "normal",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "lg",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: true,
    },
  },

  // ─── テック・開発者系 (Tech / Developer) ────────────────────────────────
  {
    id: "61",
    category: "テック・開発者系",
    name: "GitHub Light",
    config: {
      bgTheme: "white",
      radius: "sm",
      font: "sans",
      weight: "normal",
      accent: "emerald",
      texture: "flat",
      density: "compact",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "62",
    category: "テック・開発者系",
    name: "VSCode Dark",
    config: {
      bgTheme: "dark",
      radius: "none",
      font: "mono",
      weight: "normal",
      accent: "blue",
      texture: "flat",
      density: "compact",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "none",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "63",
    category: "テック・開発者系",
    name: "Vercel",
    config: {
      bgTheme: "pitchBlack",
      radius: "sm",
      font: "sans",
      weight: "medium",
      accent: "white",
      texture: "flat",
      density: "normal",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "64",
    category: "テック・開発者系",
    name: "Terminal",
    config: {
      bgTheme: "pitchBlack",
      radius: "none",
      font: "mono",
      weight: "normal",
      accent: "emerald",
      texture: "neon",
      density: "compact",
      animation: "off",
      mouseEffect: "glow",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "65",
    category: "テック・開発者系",
    name: "Monokai",
    config: {
      bgTheme: "dark",
      radius: "md",
      font: "mono",
      weight: "normal",
      accent: "amber",
      texture: "flat",
      density: "compact",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "66",
    category: "テック・開発者系",
    name: "Solarized Dark",
    config: {
      bgTheme: "dark",
      radius: "sm",
      font: "mono",
      weight: "normal",
      accent: "cyan",
      texture: "flat",
      density: "compact",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "67",
    category: "テック・開発者系",
    name: "Solarized Light",
    config: {
      bgTheme: "cream",
      radius: "sm",
      font: "mono",
      weight: "normal",
      accent: "cyan",
      texture: "flat",
      density: "compact",
      animation: "fade",
      mouseEffect: "none",
      shadow: "none",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "68",
    category: "テック・開発者系",
    name: "Gruvbox",
    config: {
      bgTheme: "dark",
      radius: "sm",
      font: "mono",
      weight: "medium",
      accent: "amber",
      texture: "flat",
      density: "compact",
      animation: "slide",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "69",
    category: "テック・開発者系",
    name: "React Blue",
    config: {
      bgTheme: "dark",
      radius: "lg",
      font: "sans",
      weight: "medium",
      accent: "cyan",
      texture: "glass",
      density: "normal",
      animation: "blur",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
  {
    id: "70",
    category: "テック・開発者系",
    name: "StackOverflow",
    config: {
      bgTheme: "white",
      radius: "sm",
      font: "sans",
      weight: "normal",
      accent: "amber",
      texture: "flat",
      density: "compact",
      animation: "fade",
      mouseEffect: "none",
      shadow: "sm",
      border: "thin",
      iconStyle: "lucide",
      language: "en",
      useGradient: false,
    },
  },
];

// === 選択要素のスライドアニメーション用コンポーネント ===
function AnimatedToggle({
  options,
  current,
  onChange,
  className = "",
  optionClassName = "",
  isTextIcon = false,
}) {
  const containerRef = useRef(null);
  const [highlightStyle, setHighlightStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
    ready: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeIndex = options.findIndex((o) => o.value === current);
    if (activeIndex === -1) return;

    // 背景ハイライト要素を避けて、実際のボタン要素だけを取得する
    const buttons = Array.from(
      containerRef.current.querySelectorAll(":scope > button")
    );
    const target = buttons[activeIndex];

    if (target) {
      setHighlightStyle(() => ({
        left: target.offsetLeft,
        width: target.offsetWidth,
        opacity: 1,
        ready: true, // 初回セット後にアニメーションを有効にする
      }));
    }
  }, [current, options]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-wrap gap-1 p-1 ${className}`}
    >
      {/* 背景ハイライト要素 */}
      <div
        className="absolute top-1 bottom-1 rounded-md pointer-events-none ui-highlight-bg"
        style={{
          left: highlightStyle.left,
          width: highlightStyle.width,
          opacity: highlightStyle.opacity,
          transition: highlightStyle.ready
            ? "all var(--ui-transition) cubic-bezier(0.2, 0.8, 0.2, 1)"
            : "none",
        }}
      />
      {options.map(({ value, label, textIcon, icon: Icon }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors duration-300 ${optionClassName} ${isActive
                ? "text-[var(--ui-accent)] font-bold"
                : "text-[var(--ui-text-muted)] hover:bg-slate-500/10 font-medium"
              }`}
          >
            {isTextIcon && textIcon ? (
              <span className="font-mono font-bold">[{textIcon}]</span>
            ) : (
              Icon && <Icon size={14} />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// === 日付ユーティリティ ===
// 月曜始まりの週の範囲 [start, end) を返す
const getWeekRange = (baseDate) => {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0:日 1:月 ... 6:土
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

const addWeeks = (date, weeks) => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

const formatWeekLabel = (start) => {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1
    }/${end.getDate()}`;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const formatDue = (dueString) => {
  if (!dueString) return null;
  const d = new Date(dueString);
  if (Number.isNaN(d.getTime())) return null; // 不正な日付によるエラーを防止

  // UTCでの時刻が00:00:00の場合は「日付のみ指定（時間は未指定）」とみなす
  const isDateOnly =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const w = WEEKDAYS[d.getDay()];

  if (!isDateOnly) {
    const hh = d.getHours();
    const mi = d.getMinutes();
    const hstr = String(hh).padStart(2, "0");
    const mstr = String(mi).padStart(2, "0");
    return `${mm}/${dd}(${w}) ${hstr}:${mstr}`;
  }
  return `${mm}/${dd}(${w})`;
};

const isOverdue = (dueString) => {
  if (!dueString) return false;
  return new Date(dueString).getTime() < Date.now();
};

const formatDate = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// <input type="datetime-local"> 用のフォーマット
/*
const toDatetimeLocalValue = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};
*/

const sameLocalDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false; // エラー防止
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

/**
 * カレンダー用: Tasks API の日付のみ期限は YYYY-MM-DD または UTC 午前0時で返ることが多い。
 * new Date(due) をローカル日で切るとタイムゾーンで前日になりセルから漏れるため、暦日で比較する。
 */
const dueCalendarDayParts = (dueString) => {
  if (!dueString) return null;
  const s = String(dueString).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    return { y: +dateOnly[1], mo: +dateOnly[2] - 1, d: +dateOnly[3] };
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const utcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  if (utcMidnight) {
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate() };
  }
  return { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate() };
};

const _dueMatchesCalendarDay = (dueString, dayDate) => {
  const parts = dueCalendarDayParts(dueString);
  if (!parts) return false;
  return (
    parts.y === dayDate.getFullYear() &&
    parts.mo === dayDate.getMonth() &&
    parts.d === dayDate.getDate()
  );
};

const CAL_WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const ACTIVE_SECTION_TITLES = [
  "期限切れ",
  "今日",
  "明日",
  "それ以外の今週",
  "来週", // 追加
  "それ以降",
  "期限なし",
];

/** アクティブ並び: 0期限切れ 1今日 2明日 3それ以外の今週 4来週 5それ以降 6期限なし */
const getActiveSortKey = (task, now, weekStart, weekEnd) => {
  if (!task.due) return { bucket: 6, dueMs: Number.POSITIVE_INFINITY };
  const due = new Date(task.due);
  const dueMs = due.getTime();
  if (isOverdue(task.due)) return { bucket: 0, dueMs };

  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

  if (sameLocalDay(due, now)) return { bucket: 1, dueMs };
  if (sameLocalDay(due, tmr)) return { bucket: 2, dueMs };
  if (due >= weekStart && due < weekEnd) return { bucket: 3, dueMs };
  if (due >= nextWeekStart && due < nextWeekEnd) return { bucket: 4, dueMs };
  return { bucket: 5, dueMs };
};

/** タイトル内の LMS 名（単語境界・大文字小文字無視）を検出用 */
const LMS_IN_TITLE = [
  { re: /\bmoodle\b/i, label: "Moodle" },
  { re: /\bcanvas\b/i, label: "Canvas" },
  { re: /\bclassroom\b/i, label: "Classroom" },
];

const getLmsBadgeClass = (label) => {
  if (label === "Moodle")
    return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
  if (label === "Canvas")
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  if (label === "Classroom")
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  return "bg-slate-500/10 text-[var(--ui-text-muted)] border-slate-500/20";
};

const _getLmsBadgeStyle = (label) => {
  if (label === "Moodle")
    return {
      color: "var(--tag-4-text)",
      backgroundColor: "var(--tag-4-bg)",
      borderColor: "var(--tag-4-border)",
    };
  if (label === "Canvas")
    return {
      color: "var(--tag-1-text)",
      backgroundColor: "var(--tag-1-bg)",
      borderColor: "var(--tag-1-border)",
    };
  if (label === "Classroom")
    return {
      color: "var(--tag-2-text)",
      backgroundColor: "var(--tag-2-bg)",
      borderColor: "var(--tag-2-border)",
    };
  return {
    color: "var(--ui-text-muted)",
    backgroundColor: "var(--ui-hover)",
    borderColor: "var(--ui-border)",
  };
};

const _getTagColorStyle = (tag) => {
  const s = String(tag || "");
  if (s === "未分類" || !s)
    return {
      color: "var(--ui-text-muted)",
      backgroundColor: "var(--ui-hover)",
      borderColor: "var(--ui-border)",
    };
  let hash = 0;
  for (let i = 0; i < s.length; i++)
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const idx = (Math.abs(hash) % 6) + 1;
  return {
    color: `var(--tag-${idx}-text)`,
    backgroundColor: `var(--tag-${idx}-bg)`,
    borderColor: `var(--tag-${idx}-border)`,
  };
};

export default function App() {
  // 上部カードの横スクロール用
  const topCardsScrollRef = useRef(null);
  const handleTopCardsScroll = (direction) => {
    if (topCardsScrollRef.current) {
      const amount = 320;
      topCardsScrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  const [clientId, setClientId] = useState(
    () => localStorage.getItem("google_tasks_client_id") || ENV_CLIENT_ID || ""
  );
  const [clientIdOverrideOpen, setClientIdOverrideOpen] = useState(
    !ENV_CLIENT_ID
  );
  const [accessToken, setAccessToken] = useState(() => {
    const cid = effectiveClientId();
    if (!cid) return null;
    const stored = readStoredOAuth(cid);
    if (stored && stored.expiresAt > Date.now() + 30_000)
      return stored.accessToken;
    return null;
  });
  const silentAuthTried = useRef(false);
  const [isDemo, setIsDemo] = useState(false);
  const [tasks, setTasks] = useState(() => {
    try {
      const cached = localStorage.getItem("google_tasks_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // ▼ NEW: バックグラウンドでトークン更新を試みる関数
  const refreshSilentToken = () => {
    return new Promise((resolve, reject) => {
      const cid = effectiveClientId();
      if (!window.google || !cid) {
        reject(
          new Error("Google Identity API not loaded or Client ID missing")
        );
        return;
      }
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              if (response.error === "popup_blocked_by_browser") {
                console.warn(
                  "[GSI] Silent refresh was blocked by the browser. Third-party cookies might be disabled or popups are blocked."
                );
              }
              reject(response);
            } else {
              writeStoredOAuth(cid, response.access_token, response.expires_in);
              setAccessToken(response.access_token);
              resolve(response.access_token);
            }
          },
        });
        // prompt: 'none' でユーザーに画面を見せずにトークン取得を試みる
        client.requestAccessToken({ prompt: "none" });
      } catch (err) {
        console.error("[GSI] Failed to request silent access token:", err);
        reject(err);
      }
    });
  };

  const parseTask = (task) => {
    // titleが存在しない（null/undefined）場合のエラーを回避
    const title = task.title || "";
    const tagRegex = /\[(.*?)\]/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(title)) !== null) {
      if (match[1].trim() !== "") {
        tags.push(match[1].toLowerCase());
      }
    }
    let cleanTitle = title.replace(/\[(.*?)\]/g, "").trim();
    const platforms = [];
    for (const { re, label } of LMS_IN_TITLE) {
      if (re.test(cleanTitle)) {
        if (!platforms.includes(label)) platforms.push(label);
        cleanTitle = cleanTitle.replace(re, " ");
      }
    }
    cleanTitle = cleanTitle.replace(/\s+/g, " ").trim();

    let combinedDue = task.due;
    const notes = task.notes || "";
    const timeMatch = notes.match(/\[time:(\d{2}):(\d{2})\]/);
    if (combinedDue && timeMatch) {
      const d = new Date(combinedDue);
      d.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      combinedDue = d.toISOString();
    }

    return {
      ...task,
      tags,
      platforms,
      cleanTitle: cleanTitle || "（タイトルなし）",
      due: combinedDue,
    };
  };

  const handleAuth = () => {
    const cid = clientId.trim() || ENV_CLIENT_ID;
    if (!cid) {
      setError(
        "Client IDがありません。.env に VITE_GOOGLE_CLIENT_ID を設定するか、入力してください。"
      );
      return;
    }
    if (!window.google) {
      setError(
        "Google APIのスクリプトが読み込まれていません。リロードしてください。"
      );
      return;
    }

    localStorage.setItem("google_tasks_client_id", cid);
    setError(null);

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            setError(
              "認証に失敗しました。以前の権限でログイン中の場合は一度切断してください。"
            );
            return;
          }
          localStorage.setItem("google_tasks_auto_login", "true");
          writeStoredOAuth(cid, response.access_token, response.expires_in);
          setAccessToken(response.access_token);
        },
      });
      // consent画面を強制せず、認証済みなら裏で通す設定
      client.requestAccessToken({ prompt: "" });
    } catch {
      setError("認証の初期化に失敗しました。");
    }
  };

  const fetchRealTasks = async (token) => {
    // Avoid synchronous setState in effect
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let lists = [];
      let listsPageToken = "";
      do {
        const query = new URLSearchParams({
          maxResults: String(FETCH_MAX_RESULTS),
          ...(listsPageToken ? { pageToken: listsPageToken } : {}),
        });
        const listsRes = await fetch(
          `https://tasks.googleapis.com/tasks/v1/users/@me/lists?${query.toString()}`,
          { headers }
        );

        if (listsRes.status === 401 || listsRes.status === 403) {
          try {
            // サイレント更新を試みる
            await refreshSilentToken();
            // トークンが更新されると useEffect により再度 fetchRealTasks が走るため、ここでは中断する
            return;
          } catch (silentErr) {
            clearStoredOAuth();
            setAccessToken(null);
            if (tasks.length > 0) {
              throw new Error(
                "セッションが完全に切れました。表示はキャッシュです。操作するには再接続してください。"
              );
            } else {
              throw new Error(
                "セッションが期限切れか、権限がありません。もう一度ログインしてください。"
              );
            }
          }
        }

        const data = await listsRes.json();
        if (data.items) lists.push(...data.items);
        listsPageToken = data.nextPageToken || "";
      } while (listsPageToken);

      const allTasks = [];
      for (const list of lists) {
        let tasksPageToken = "";
        do {
          const query = new URLSearchParams({
            maxResults: String(FETCH_MAX_RESULTS),
            showCompleted: "true",
            showHidden: "true",
            ...(tasksPageToken ? { pageToken: tasksPageToken } : {}),
          });
          const res = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${list.id
            }/tasks?${query.toString()}`,
            { headers }
          );
          const tasksData = await res.json();
          if (tasksData.items) {
            allTasks.push(...tasksData.items);
          }
          tasksPageToken = tasksData.nextPageToken || "";
        } while (tasksPageToken);
      }
      setTasks(allTasks.map(parseTask));
      setIsDemo(false);
    } catch (err) {
      setError(err.message || "タスクの取得中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = () => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      setTasks(MOCK_TASKS.map(parseTask));
      setIsDemo(true);
      setLoading(false);
    }, 600);
  };

  useEffect(() => {
    if (tasks.length > 0 && !isDemo) {
      localStorage.setItem("google_tasks_cache", JSON.stringify(tasks));
    }
  }, [tasks, isDemo]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const v = localStorage.getItem("task_dashboard_tab") || "active";
    const valid = [
      "active",
      "history",
      "calendar",
      "analytics",
      "organize",
      "settings",
    ];
    return valid.includes(v) ? v : "active";
  });
  useEffect(() => {
    localStorage.setItem("task_dashboard_tab", activeTab);
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTags, setNewTaskTags] = useState([]);
  const [newTaskDue, setNewTaskDue] = useState("");
  const [dueFilter, setDueFilter] = useState("all"); // 'all' | 'hasDue' | 'noDue'
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [organizeSubTab, setOrganizeSubTab] = useState("tags"); // 'tags' | 'routines'

  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [sidebarFilterTab, setSidebarFilterTab] = useState("tags"); // 追加: タグとルーチンの切り替え用

  // Sidebar highlight & Mouse effects
  const sidebarNavRef = useRef(null);
  const [navHighlightStyle, setNavHighlightStyle] = useState({
    top: 0,
    height: 0,
    opacity: 0,
    ready: false,
  });

  const [uiConfig, setUiConfig] = useState(() => {
    // shadow と border を初期値に追加
    const fallback = {
      bgTheme: "light",
      radius: "md",
      font: "sans",
      weight: "normal",
      accent: "blue",
      texture: "flat",
      density: "normal",
      animation: "spring",
      mouseEffect: "glow",
      shadow: "md",
      border: "thin",
      iconStyle: "lucide",
      language: "en_mix",
      useGradient: false,
    };
    try {
      const s = localStorage.getItem("task_dashboard_ui_v7");
      const parsed = s ? JSON.parse(s) : null;
      return parsed && typeof parsed === "object"
        ? { ...fallback, ...parsed }
        : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem("task_dashboard_ui_v7", JSON.stringify(uiConfig));
  }, [uiConfig]);

  const palette = {
    blue: {
      main: "#2563eb",
      dark: "#1d4ed8",
      light: "#eff6ff",
      border: "#bfdbfe",
      contrast: "#ffffff",
    },
    indigo: {
      main: "#4f46e5",
      dark: "#4338ca",
      light: "#eef2ff",
      border: "#c7d2fe",
      contrast: "#ffffff",
    },
    emerald: {
      main: "#059669",
      dark: "#047857",
      light: "#ecfdf5",
      border: "#a7f3d0",
      contrast: "#ffffff",
    },
    teal: {
      main: "#0d9488",
      dark: "#0f766e",
      light: "#f0fdfa",
      border: "#99f6e4",
      contrast: "#ffffff",
    },
    cyan: {
      main: "#0891b2",
      dark: "#0e7490",
      light: "#ecfeff",
      border: "#a5f3fc",
      contrast: "#ffffff",
    },
    rose: {
      main: "#e11d48",
      dark: "#be123c",
      light: "#fff1f2",
      border: "#fecdd3",
      contrast: "#ffffff",
    },
    fuchsia: {
      main: "#c026d3",
      dark: "#a21caf",
      light: "#fdf4ff",
      border: "#f5d0fe",
      contrast: "#ffffff",
    },
    amber: {
      main: "#d97706",
      dark: "#b45309",
      light: "#fffbeb",
      border: "#fde68a",
      contrast: "#ffffff",
    },
    violet: {
      main: "#7c3aed",
      dark: "#6d28d9",
      light: "#f5f3ff",
      border: "#ddd6fe",
      contrast: "#ffffff",
    },
    slate: {
      main: "#64748b",
      dark: "#475569",
      light: "#f8fafc",
      border: "#e2e8f0",
      contrast: "#ffffff",
    },
    zinc: {
      main: "#52525b",
      dark: "#3f3f46",
      light: "#fafafa",
      border: "#e4e4e7",
      contrast: "#ffffff",
    },
    white: {
      main: "#ffffff",
      dark: "#f1f5f9",
      light: "#ffffff",
      border: "#e5e5e5",
      contrast: "#0f172a",
    },
    black: {
      main: "#09090b",
      dark: "#000000",
      light: "#27272a",
      border: "#3f3f46",
      contrast: "#ffffff",
    },
    gold: {
      main: "#d4af37",
      dark: "#b5952f",
      light: "#fbf8ef",
      border: "#eaddb0",
      contrast: "#ffffff",
    },
    bronze: {
      main: "#cd7f32",
      dark: "#a36528",
      light: "#fcf4ed",
      border: "#e8cdb5",
      contrast: "#ffffff",
    },
    sand: {
      main: "#e7e5e4",
      dark: "#d6d3d1",
      light: "#fafaf9",
      border: "#f5f5f4",
      contrast: "#1c1917",
    },
  };

  const bgThemes = {
    white: {
      bg: "#f4f4f5",
      text: "#09090b",
      textMuted: "#71717a",
      panel: "#ffffff",
      border: "#e4e4e7",
    },
    light: {
      bg: "#f8fafc",
      text: "#0f172a",
      textMuted: "#64748b",
      panel: "#ffffff",
      border: "#e2e8f0",
    },
    paper: {
      bg: "#eae7de",
      text: "#262626",
      textMuted: "#737373",
      panel: "#f5f4ef",
      border: "#d4d2c8",
    },
    gray: {
      bg: "#d1d5db",
      text: "#111827",
      textMuted: "#4b5563",
      panel: "#f3f4f6",
      border: "#9ca3af",
    },
    dark: {
      bg: "#0f172a",
      text: "#f8fafc",
      textMuted: "#94a3b8",
      panel: "#1e293b",
      border: "#334155",
    },
    navy: {
      bg: "#020617",
      text: "#e2e8f0",
      textMuted: "#64748b",
      panel: "#0f172a",
      border: "#1e293b",
    },
    pitchBlack: {
      bg: "#000000",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      panel: "#09090b",
      border: "#27272a",
    },
    cream: {
      bg: "#fefce8",
      text: "#451a03",
      textMuted: "#a16207",
      panel: "#fef9c3",
      border: "#fde047",
    },
    sepia: {
      bg: "#f3e8d2",
      text: "#433422",
      textMuted: "#854d0e",
      panel: "#faedd6",
      border: "#e6d5b8",
    },
  };

  const uiColors = palette[uiConfig.accent] || palette.blue;
  const tColors = bgThemes[uiConfig.bgTheme] || bgThemes.light;

  const fontMap = {
    sans: '"Noto Sans JP", sans-serif',
    mono: '"JetBrains Mono", monospace',
    serif: '"Noto Serif JP", serif',
    rounded: '"M PLUS Rounded 1c", sans-serif',
    shippori: '"Shippori Mincho B1", serif',
    zenOld: '"Zen Old Mincho", serif',
    zenKakuNew: '"Zen Kaku Gothic New", sans-serif',
    zenKakuAntique: '"Zen Kaku Gothic Antique", sans-serif',
    bizUD: '"BIZ UDPGothic", sans-serif',
    lineSeed: '"LINE Seed JP", sans-serif',
  };

  const weightSettings = {
    light: { base: 300, medium: 400, bold: 500, black: 700 },
    normal: { base: 400, medium: 500, bold: 700, black: 900 },
    medium: { base: 500, medium: 600, bold: 800, black: 900 },
    bold: { base: 700, medium: 800, bold: 900, black: 900 },
    black: { base: 900, medium: 900, bold: 900, black: 900 },
  };
  const currentWeight =
    weightSettings[uiConfig.weight] || weightSettings.normal;

  const radiusMap = {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "16px",
    xl: "24px",
  };

  // 余白設定（モバイルでの破綻を防ぎつつ、美しいバランスを保つ）
  const densityValues = {
    compact: { gap: "0.75rem", p: "1rem" },
    normal: { gap: "1.25rem", p: "1.5rem" },
    loose: { gap: "2rem", p: "2rem" },
  };

  const [shiftHeld, setShiftHeld] = useState(false);
  const [taskFormExpanded, setTaskFormExpanded] = useState(false);
  const [calendarMode, setCalendarMode] = useState("month");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [periodModalPeriod, setPeriodModalPeriod] = useState(null);
  const [periodModalTiltDeg, setPeriodModalTiltDeg] = useState(0);
  const [keyboardFocusedTaskId, setKeyboardFocusedTaskId] = useState(null);

  const showCheckboxes = selectionMode || shiftHeld;
  // 分析タブとそれ以外でモーダルの遷移順を安全に切り替える（エラー防止）
  const PERIOD_MODAL_ORDER = useMemo(() => {
    if (activeTab === "analytics") {
      return [
        "weekBeforeLast",
        "lastWeek",
        "week",
        "nextWeek",
        "weekAfterNext",
        "month",
        "nextMonth",
        "monthAfterNext",
      ];
    }
    return ["week", "nextWeek", "month"];
  }, [activeTab]);

  useEffect(() => {
    const onKeyUp = (e) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    const onBlur = () => setShiftHeld(false);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google || silentAuthTried.current) return;
      const cid = effectiveClientId();
      if (!cid) return;
      const stored = readStoredOAuth(cid);
      const autoLogin = localStorage.getItem("google_tasks_auto_login");

      if (stored && stored.expiresAt > Date.now() + 30_000) {
        setAccessToken(stored.accessToken);
        return;
      }

      if (autoLogin === "true") {
        silentAuthTried.current = true;
        refreshSilentToken().catch(() => {
          // 初期サイレントログイン失敗。操作するには手動ログインが必要。
          silentAuthTried.current = false;
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // ▼ NEW: トークンの自動更新（期限5分前に発火）
  useEffect(() => {
    if (!accessToken) return;
    const cid = effectiveClientId();
    const stored = readStoredOAuth(cid);
    if (!stored) return;

    // 期限の何ミリ秒前か
    const timeToExpiry = stored.expiresAt - Date.now();
    const refreshMargin = 5 * 60 * 1000; // 5分前
    const timeToRefresh = timeToExpiry - refreshMargin;

    if (timeToRefresh > 0) {
      const timer = setTimeout(() => {
        refreshSilentToken().catch(() => {
          // サイレント更新失敗時はそのまま（APIリクエスト時に401で再度リカバリか再接続へ）
        });
      }, timeToRefresh);
      return () => clearTimeout(timer);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || isDemo) return;
    const timer = setTimeout(() => fetchRealTasks(accessToken), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isDemo]);



  const handleLogout = () => {
    clearStoredOAuth();
    localStorage.removeItem("google_tasks_auto_login");
    localStorage.removeItem("google_tasks_cache");
    setAccessToken(null);
    setTasks([]);
    setIsDemo(false);
    setSelectedTag(null);
    setSelectedTasks(new Set());
    setSelectionMode(false);
    setIsMobileMenuOpen(false);
    setPeriodModalPeriod(null);
    silentAuthTried.current = false;
  };

  const toggleSelection = (taskId) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (!accessToken && !isDemo) {
      alert("セッションが切れています。再接続してください。");
      handleAuth();
      return;
    }
    if (!window.confirm(`${selectedTasks.size}件のタスクを削除しますか？`))
      return;
    setLoading(true);
    const tasksToDelete = tasks.filter((t) => selectedTasks.has(t.id));

    setTasks((prev) => prev.filter((t) => !selectedTasks.has(t.id)));
    setSelectedTasks(new Set());

    if (!isDemo) {
      try {
        await Promise.all(
          tasksToDelete.map((task) =>
            fetch(
              `https://tasks.googleapis.com/tasks/v1/lists/${task.listId || "@default"}/tasks/${task.id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            )
          )
        );
      } catch {
        alert("一部のタスクの削除に失敗しました");
        fetchRealTasks(accessToken);
      }
    }
    setLoading(false);
  };

  const handleRefresh = () => {
    if (isDemo) loadDemo();
    else if (accessToken) fetchRealTasks(accessToken);
  };

  const copyAiPrompt = () => {
    const prompt =
      "以下の要件でタスクリストを生成して。形式は「[タグ] タスク名, 日付(YYYY-MM-DD)」として、各タスクは改行で区切って出力してください。";
    navigator.clipboard.writeText(prompt);
    alert("AIアシスタント用のプロンプトをコピーしました。");
  };

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (!accessToken && !isDemo) {
      alert("セッションが切れています。再接続してください。");
      handleAuth();
      return;
    }

    setLoading(true);
    const lines = (newTaskTitle || "").split("\n").filter((l) => l.trim() !== "");
    const newTasks = [];

    // GUIで設定された期限とタグ
    const guiDueIso = newTaskDue
      ? new Date(newTaskDue).toISOString()
      : undefined;

    for (const line of lines) {
      let text = line.trim();
      let dueIso = guiDueIso; // デフォルトはGUIの指定
      let tags = [...newTaskTags]; // デフォルトはGUIの指定

      // 日付のスマートパース（行末の ", 日付" を探す）
      const dateMatch = text.match(/(.*),\s*([^,]+)$/);
      if (dateMatch) {
        const potentialDate = dateMatch[2].trim();
        const d = new Date(potentialDate);
        if (!Number.isNaN(d.getTime())) {
          text = dateMatch[1].trim();
          dueIso = d.toISOString(); // テキスト指定があれば上書き
        }
      }

      // タグのパース [Tag]
      const tagMatches = text.matchAll(/\[(.*?)\]/g);
      for (const m of tagMatches) {
        tags.push(m[1].toLowerCase());
      }
      tags = [...new Set(tags)]; // 重複排除

      // API制約上、title内にタグを埋め込んで保存する
      const cleanTitleForApi = text.replace(/\[.*?\]/g, "").trim();
      const prefix = tags.map((t) => `[${t}]`).join("");
      const fullTitle = prefix
        ? `${prefix} ${cleanTitleForApi}`
        : cleanTitleForApi;

      let notes = "";
      if (dueIso) {
        const d = new Date(dueIso);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        notes = `[time:${hh}:${mm}]`;
      }

      if (isDemo) {
        newTasks.push({
          id: `demo-${Date.now()}-${Math.random()}`,
          listId: "demo",
          title: fullTitle,
          status: "needsAction",
          due: dueIso,
          notes,
          updated: new Date().toISOString(),
        });
      } else {
        const body = { title: fullTitle, notes };
        if (dueIso) body.due = dueIso;
        try {
          const res = await fetch(
            "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            }
          );
          if (res.ok) {
            const data = await res.json();
            newTasks.push({ ...data, listId: "@default" });
          }
        } catch {
          /* 行ごとの失敗はスキップ */
        }
      }
    }

    setTasks((prev) => [...newTasks.map(parseTask), ...prev]);
    setNewTaskTitle("");
    setNewTaskTags([]);
    setNewTaskDue("");
    setTaskFormExpanded(false);
    if (!isDemo && newTasks.length === 0 && lines.length > 0) {
      alert("タスクの追加に失敗しました");
    }
    setLoading(false);
  };

  const toggleTaskStatus = async (task) => {
    if (!accessToken && !isDemo) {
      alert("セッションが切れています。再接続してください。");
      handleAuth();
      return;
    }
    const newStatus = task.status === "completed" ? "needsAction" : "completed";
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
            ...t,
            status: newStatus,
            completed: newStatus === "completed" ? now : null,
          }
          : t
      )
    );

    if (!isDemo) {
      try {
        await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${task.listId || "@default"}/tasks/${task.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: newStatus }),
          }
        );
      } catch {
        alert("ステータスの更新に失敗しました");
        fetchRealTasks(accessToken);
      }
    }
  };

  // === ルーチン検出 ===
  const routineGroups = useMemo(() => {
    let filteredForRoutine = tasks;
    if (selectedTag) {
      filteredForRoutine =
        selectedTag === "未分類"
          ? tasks.filter((t) => t.tags.length === 0)
          : tasks.filter((t) => t.tags.includes(selectedTag));
    }

    const wordCounts = {};
    filteredForRoutine.forEach((t) => {
      const cleanTitle = t.cleanTitle || "";
      const words = cleanTitle.split(/[\s,，、・\-()（）[\]［］{}｛｝]+/);
      words.forEach((w) => {
        if (w.length < 2 || /^[0-9０-９]+$/.test(w)) return;
        if (/課題[0-9０-９]+/.test(w) || /[0-9０-９]+回/.test(w)) return;
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      });
    });

    const threshold = 3;
    const routineKeywords = Object.keys(wordCounts).filter(
      (w) => wordCounts[w] >= threshold
    );

    const tempGroups = {};
    filteredForRoutine.forEach((t) => {
      const cleanTitle = t.cleanTitle || "";
      const words = cleanTitle.split(/[\s,，、・\-()（）[\]［］{}｛｝]+/);
      const taskKeywords = [
        ...new Set(words.filter((w) => routineKeywords.includes(w))),
      ];

      taskKeywords.forEach((kw) => {
        if (!tempGroups[kw]) {
          tempGroups[kw] = {
            title: [kw],
            count: 0,
            completedCount: 0,
            tasks: [],
            taskIds: new Set(),
          };
        }
        tempGroups[kw].count += 1;
        tempGroups[kw].tasks.push(t);
        tempGroups[kw].taskIds.add(t.id);
        if (t.status === "completed") tempGroups[kw].completedCount += 1;
      });
    });

    const mergedGroups = [];
    Object.values(tempGroups).forEach((group) => {
      if (group.count < threshold) return;
      const existing = mergedGroups.find(
        (mg) =>
          mg.taskIds.size === group.taskIds.size &&
          [...mg.taskIds].every((id) => group.taskIds.has(id))
      );
      if (existing) {
        existing.title.push(...group.title);
      } else {
        mergedGroups.push(group);
      }
    });

    return mergedGroups
      .map((g) => ({
        ...g,
        titleLabel: g.title.join(" / "),
        activeCount: g.count - g.completedCount,
      }))
      .sort((a, b) => b.activeCount - a.activeCount || b.count - a.count);
  }, [tasks, selectedTag]);

  // ▼ 追加: routineGroups確定後にIDセットを算出
  const selectedRoutineTaskIds = useMemo(() => {
    if (!selectedRoutine) return null;
    const rg = routineGroups.find((g) => g.titleLabel === selectedRoutine);
    return rg ? rg.taskIds : new Set();
  }, [selectedRoutine, routineGroups]);

  // ▼ 追加: タグ×ルーチンの共通フィルター（全ビューで使い回す）
  const baseFilteredTasks = useMemo(() => {
    let f = tasks;
    if (selectedTag) {
      f =
        selectedTag === "未分類"
          ? f.filter((t) => t.tags.length === 0)
          : f.filter((t) => t.tags.includes(selectedTag));
    }
    if (selectedRoutineTaskIds) {
      f = f.filter((t) => selectedRoutineTaskIds.has(t.id));
    }
    return f;
  }, [tasks, selectedTag, selectedRoutineTaskIds]);

  // === 集計 ===
  const {
    stats,
    tagStats,
    weeklyStats,
    nextWeekStats,
    weekAfterNextStats,
    monthStats,
    nextMonthStats,
    monthAfterNextStats,
    weekBeforeLastStats,
    lastWeekStats,
    weeklyHistory,
    monthlyHistory,
    yearlyHistory,
    overallCompletionRate,
    analyticsTotalTasks,
    analyticsCompletedTasks,
  } = useMemo(() => {
    const tagData = {};
    const total = tasks.length;
    let completed = 0;

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(now);
    const nextWeekStart = addWeeks(weekStart, 1);
    const nextWeekEnd = addWeeks(weekStart, 2);
    const weekAfterNextStart = addWeeks(weekStart, 2);
    const weekAfterNextEnd = addWeeks(weekStart, 3);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const monthAfterNextStart = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      1
    );
    const monthAfterNextEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 3,
      1
    );
    const lastWeekStart = addWeeks(weekStart, -1);
    const lastWeekEnd = weekStart;
    const weekBeforeLastStart = addWeeks(weekStart, -2);
    const weekBeforeLastEnd = lastWeekStart;

    // ▼ 週跨ぎ遅延タスクの所属週（effectiveDate）を再定義
    const tasksForTopDashboard = baseFilteredTasks.map((t) => {
      if (!t.due) {
        // 期限なしでも完了していれば、完了した週の実績として扱う
        if (t.status === "completed" && t.completed) {
          const compD = new Date(t.completed);
          if (!Number.isNaN(compD.getTime())) {
            return {
              ...t,
              effectiveDate: compD,
              isRollover: false,
              isDelayedCompletion: false,
            };
          }
        }
        return {
          ...t,
          effectiveDate: null,
          isRollover: false,
          isDelayedCompletion: false,
        };
      }
      const dueD = new Date(t.due);
      if (Number.isNaN(dueD.getTime())) {
        return {
          ...t,
          effectiveDate: null,
          isRollover: false,
          isDelayedCompletion: false,
        };
      }
      const dueW = getWeekRange(dueD).start.getTime();
      const nowW = weekStart.getTime();

      let effectiveDate = dueD;
      let isRollover = false;
      let isDelayedCompletion = false;

      if (t.status === "completed" && t.completed) {
        const compD = new Date(t.completed);
        const compW = getWeekRange(compD).start.getTime();
        // 期限の週より後に完了した場合は、完了した週の実績として扱う
        if (compW > dueW) {
          effectiveDate = compD;
          isDelayedCompletion = true;
        }
      } else {
        // 未完了で期限の週が今週より前の場合は、今週分に繰り越し
        if (dueW < nowW) {
          effectiveDate = new Date(now);
          isRollover = true;
        }
      }
      return { ...t, effectiveDate, isRollover, isDelayedCompletion };
    });

    let weekTotal = 0,
      weekCompleted = 0;
    const weekTasks = [];
    let nextWeekTotal = 0,
      nextWeekCompleted = 0;
    const nextWeekTasks = [];
    let weekAfterNextTotal = 0,
      weekAfterNextCompleted = 0;
    const weekAfterNextTasks = [];
    let monthTotal = 0,
      monthCompleted = 0;
    const monthTasks = [];
    let nextMonthTotal = 0,
      nextMonthCompleted = 0;
    const nextMonthTasks = [];
    let monthAfterNextTotal = 0,
      monthAfterNextCompleted = 0;
    const monthAfterNextTasks = [];
    let lastWeekTotal = 0,
      lastWeekCompleted = 0;
    const lastWeekTasks = [];
    let weekBeforeLastTotal = 0,
      weekBeforeLastCompleted = 0;
    const weekBeforeLastTasks = [];

    let analyticsCompleted = 0;
    tasksForTopDashboard.forEach((t) => {
      const isCompleted = t.status === "completed";
      if (isCompleted) analyticsCompleted++;

      const effDate = t.effectiveDate;
      if (effDate) {
        if (effDate >= weekStart && effDate < weekEnd) {
          weekTotal++;
          if (isCompleted) weekCompleted++;
          weekTasks.push(t);
        }
        if (effDate >= nextWeekStart && effDate < nextWeekEnd) {
          nextWeekTotal++;
          if (isCompleted) nextWeekCompleted++;
          nextWeekTasks.push(t);
        }
        if (effDate >= weekAfterNextStart && effDate < weekAfterNextEnd) {
          weekAfterNextTotal++;
          if (isCompleted) weekAfterNextCompleted++;
          weekAfterNextTasks.push(t);
        }
        if (effDate >= monthStart && effDate < monthEnd) {
          monthTotal++;
          if (isCompleted) monthCompleted++;
          monthTasks.push(t);
        }
        if (effDate >= nextMonthStart && effDate < nextMonthEnd) {
          nextMonthTotal++;
          if (isCompleted) nextMonthCompleted++;
          nextMonthTasks.push(t);
        }
        if (effDate >= monthAfterNextStart && effDate < monthAfterNextEnd) {
          monthAfterNextTotal++;
          if (isCompleted) monthAfterNextCompleted++;
          monthAfterNextTasks.push(t);
        }
        if (effDate >= lastWeekStart && effDate < lastWeekEnd) {
          lastWeekTotal++;
          if (isCompleted) lastWeekCompleted++;
          lastWeekTasks.push(t);
        }
        if (effDate >= weekBeforeLastStart && effDate < weekBeforeLastEnd) {
          weekBeforeLastTotal++;
          if (isCompleted) weekBeforeLastCompleted++;
          weekBeforeLastTasks.push(t);
        }
      }
    });
    const analyticsTotal = tasksForTopDashboard.length;
    const overall =
      analyticsTotal === 0
        ? 0
        : Math.round((analyticsCompleted / analyticsTotal) * 100);

    const initTagData = (tag) => {
      if (!tagData[tag])
        tagData[tag] = { total: 0, completed: 0, active7Days: 0 };
    };

    const nowMs = now.getTime();
    const next7DaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;

    tasks.forEach((t) => {
      const isCompleted = t.status === "completed";
      if (isCompleted) completed++;

      // 7日以内の未完了タスク判定
      const dMs = t.due ? new Date(t.due).getTime() : NaN;
      const isWithin7Days =
        !isCompleted &&
        !Number.isNaN(dMs) &&
        dMs >= nowMs &&
        dMs <= next7DaysMs;

      const tags = t.tags.length === 0 ? ["未分類"] : t.tags;
      tags.forEach((tag) => {
        initTagData(tag);
        tagData[tag].total++;
        if (isCompleted) tagData[tag].completed++;
        if (isWithin7Days) tagData[tag].active7Days++;
      });
    });

    const tagStatsList = Object.entries(tagData)
      .map(([tag, data]) => {
        const rate =
          data.total === 0
            ? 0
            : Math.round((data.completed / data.total) * 100);
        return { tag, ...data, rate, active: data.total - data.completed };
      })
      .sort((a, b) => b.active7Days - a.active7Days || b.active - a.active); // 7日以内の数が多い順にソート

    // 過去7週 + 今週 + 来週 = 9週分
    const history = [];
    for (let i = 7; i >= -1; i--) {
      const weekStartN = addWeeks(weekStart, -i);
      const weekEndN = addWeeks(weekStartN, 1);
      let wTotal = 0;
      let wDone = 0;
      const wTasks = [];
      tasksForTopDashboard.forEach((t) => {
        if (!t.effectiveDate) return;
        const d = t.effectiveDate;
        if (d >= weekStartN && d < weekEndN) {
          wTotal++;
          if (t.status === "completed") wDone++;
          wTasks.push(t);
        }
      });
      const wRate = wTotal === 0 ? 0 : Math.round((wDone / wTotal) * 100);
      history.push({
        key: weekStartN.toISOString(),
        label: formatWeekLabel(weekStartN),
        total: wTotal,
        completed: wDone,
        rate: wRate,
        isCurrent: i === 0,
        isFuture: i < 0,
        tasks: wTasks,
      });
    }

    const monthlyHistory = [];
    // 未来6ヶ月分 (-6) まで追加
    for (let i = 11; i >= -6; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const mEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      let mt = 0,
        mc = 0;
      const mTasks = [];
      tasksForTopDashboard.forEach((t) => {
        if (!t.effectiveDate) return;
        const d = t.effectiveDate;
        if (d >= mStart && d < mEnd) {
          mt++;
          if (t.status === "completed") mc++;
          mTasks.push(t);
        }
      });
      monthlyHistory.push({
        key: mStart.toISOString(),
        label: `${ref.getFullYear()}年${ref.getMonth() + 1}月`,
        shortLabel: `${ref.getMonth() + 1}月`,
        total: mt,
        completed: mc,
        rate: mt === 0 ? 0 : Math.round((mc / mt) * 100),
        isCurrent: i === 0,
        isFuture: i < 0,
        tasks: mTasks,
      });
    }

    const yearlyHistory = [];
    const cy = now.getFullYear();
    // 未来2年分 (+2) まで追加
    for (let y = cy - 3; y <= cy + 2; y++) {
      const yStart = new Date(y, 0, 1);
      const yEnd = new Date(y + 1, 0, 1);
      let yt = 0,
        yc = 0;
      const yTasks = [];
      tasksForTopDashboard.forEach((t) => {
        if (!t.effectiveDate) return;
        const d = t.effectiveDate;
        if (d >= yStart && d < yEnd) {
          yt++;
          if (t.status === "completed") yc++;
          yTasks.push(t);
        }
      });
      yearlyHistory.push({
        key: String(y),
        label: `${y}年`,
        total: yt,
        completed: yc,
        rate: yt === 0 ? 0 : Math.round((yc / yt) * 100),
        isCurrent: y === cy,
        isFuture: y > cy,
        tasks: yTasks,
      });
    }

    return {
      stats: { total, completed, active: total - completed },
      tagStats: tagStatsList,
      weeklyStats: {
        rate:
          weekTotal === 0 ? 0 : Math.round((weekCompleted / weekTotal) * 100),
        completed: weekCompleted,
        totalTarget: weekTotal,
        tasks: weekTasks,
      },
      nextWeekStats: {
        rate:
          nextWeekTotal === 0
            ? 0
            : Math.round((nextWeekCompleted / nextWeekTotal) * 100),
        completed: nextWeekCompleted,
        totalTarget: nextWeekTotal,
        tasks: nextWeekTasks,
      },
      weekAfterNextStats: {
        rate:
          weekAfterNextTotal === 0
            ? 0
            : Math.round(
              (weekAfterNextCompleted / weekAfterNextTotal) * 100
            ),
        completed: weekAfterNextCompleted,
        totalTarget: weekAfterNextTotal,
        tasks: weekAfterNextTasks,
      },
      monthStats: {
        rate:
          monthTotal === 0 ? 0 : Math.round((monthCompleted / monthTotal) * 100),
        completed: monthCompleted,
        totalTarget: monthTotal,
        tasks: monthTasks,
      },
      nextMonthStats: {
        rate:
          nextMonthTotal === 0
            ? 0
            : Math.round((nextMonthCompleted / nextMonthTotal) * 100),
        completed: nextMonthCompleted,
        totalTarget: nextMonthTotal,
        tasks: nextMonthTasks,
      },
      monthAfterNextStats: {
        rate:
          monthAfterNextTotal === 0
            ? 0
            : Math.round(
              (monthAfterNextCompleted / monthAfterNextTotal) * 100
            ),
        completed: monthAfterNextCompleted,
        totalTarget: monthAfterNextTotal,
        tasks: monthAfterNextTasks,
      },
      weekBeforeLastStats: {
        rate:
          weekBeforeLastTotal === 0
            ? 0
            : Math.round((weekBeforeLastCompleted / weekBeforeLastTotal) * 100),
        completed: weekBeforeLastCompleted,
        totalTarget: weekBeforeLastTotal,
        tasks: weekBeforeLastTasks,
      },
      lastWeekStats: {
        rate:
          lastWeekTotal === 0
            ? 0
            : Math.round((lastWeekCompleted / lastWeekTotal) * 100),
        completed: lastWeekCompleted,
        totalTarget: lastWeekTotal,
        tasks: lastWeekTasks,
      },
      weeklyHistory: history,
      monthlyHistory,
      yearlyHistory,
      overallCompletionRate: overall,
      analyticsTotalTasks: analyticsTotal,
      analyticsCompletedTasks: analyticsCompleted,
    };
  }, [tasks, selectedTag, selectedRoutineTaskIds]);

  // === フィルター & ソート ===
  const { activeGroups, activeTotalCount, historyList, historyGroups } =
    useMemo(() => {
      // タグ×ルーチンは baseFilteredTasks 済み
      let filtered = baseFilteredTasks;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            (t.cleanTitle && t.cleanTitle.toLowerCase().includes(q)) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      }

      const now = new Date();
      const { start: weekStart, end: weekEnd } = getWeekRange(now);

      // ▼ 追加: 期限あり・なし のフィルタリングを適用
      let currentFiltered = filtered;
      if (dueFilter === "noDue") {
        currentFiltered = currentFiltered.filter((t) => !t.due);
      } else if (dueFilter === "hasDue") {
        currentFiltered = currentFiltered.filter((t) => !!t.due);
      }

      // 履歴データ全体の安全なソート
      const historyListRaw = currentFiltered
        .filter((t) => t.status === "completed")
        .sort((a, b) => {
          const da = a.completed ? new Date(a.completed).getTime() : 0;
          const db = b.completed ? new Date(b.completed).getTime() : 0;
          return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
        });

      // 履歴のグループ化ロジック
      const createHistoryGroups = (list) => {
        const hToday = [],
          hThisWeek = [],
          hLastWeek = [],
          hThisMonth = [],
          hLastMonth = [],
          hOlder = [];
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();

        const weekStartMs = weekStart.getTime();
        const weekEndMs = weekEnd.getTime();
        const lastWeekStartMs = addWeeks(weekStart, -1).getTime();

        const thisMonthStartMs = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        ).getTime();
        const lastMonthStartMs = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        ).getTime();

        list.forEach((t) => {
          if (!t.completed) {
            hOlder.push(t);
            return;
          }
          const cdMs = new Date(t.completed).getTime();
          // 日付がパースできない場合は Older へ
          if (Number.isNaN(cdMs)) {
            hOlder.push(t);
            return;
          }

          if (cdMs >= todayMs) hToday.push(t);
          else if (cdMs >= weekStartMs && cdMs < weekEndMs) hThisWeek.push(t);
          else if (cdMs >= lastWeekStartMs && cdMs < weekStartMs)
            hLastWeek.push(t);
          else if (cdMs >= thisMonthStartMs) hThisMonth.push(t);
          else if (cdMs >= lastMonthStartMs && cdMs < thisMonthStartMs)
            hLastMonth.push(t);
          else hOlder.push(t);
        });

        const res = [];
        if (hToday.length) res.push({ title: "今日達成", tasks: hToday });
        if (hThisWeek.length) res.push({ title: "今週達成", tasks: hThisWeek });
        if (hLastWeek.length) res.push({ title: "先週達成", tasks: hLastWeek });
        if (hThisMonth.length)
          res.push({ title: "それ以外の今月達成", tasks: hThisMonth });
        if (hLastMonth.length)
          res.push({ title: "先月達成", tasks: hLastMonth });
        if (hOlder.length) res.push({ title: "それ以前に達成", tasks: hOlder });
        return res;
      };

      // アクティブタスクの抽出とバケツ振り分け
      let active = currentFiltered.filter((t) => t.status === "needsAction");

      const buckets = ACTIVE_SECTION_TITLES.map((title, bucket) => {
        let groupTitle = title;
        if (bucket === 1) {
          groupTitle = `今日 (${now.getMonth() + 1}/${now.getDate()}(${WEEKDAYS[now.getDay()]
            }))`;
        } else if (bucket === 2) {
          const tmr = new Date(now);
          tmr.setDate(tmr.getDate() + 1);
          groupTitle = `明日 (${tmr.getMonth() + 1}/${tmr.getDate()}(${WEEKDAYS[tmr.getDay()]
            }))`;
        }
        return { bucket, title: groupTitle, tasks: [] };
      });

      active.forEach((task) => {
        const { bucket } = getActiveSortKey(task, now, weekStart, weekEnd);
        buckets[bucket].tasks.push(task);
      });
      buckets.forEach((b) => {
        b.tasks.sort((a, c) => {
          const ka = getActiveSortKey(a, now, weekStart, weekEnd);
          const kc = getActiveSortKey(c, now, weekStart, weekEnd);
          return ka.dueMs - kc.dueMs;
        });
      });
      const activeGroups = buckets.filter((b) => b.tasks.length > 0);
      const activeTotalCount = activeGroups.reduce(
        (n, g) => n + g.tasks.length,
        0
      );

      return {
        activeGroups,
        activeTotalCount,
        historyList: historyListRaw,
        historyGroups: createHistoryGroups(historyListRaw),
      };
    }, [baseFilteredTasks, dueFilter, searchQuery]);

  /*
  const tagAndSearchTaskCount = useMemo(() => {
    if (!searchQuery.trim()) return baseFilteredTasks.length;
    const q = searchQuery.toLowerCase();
    return baseFilteredTasks.filter(
      (t) =>
        (t.cleanTitle && t.cleanTitle.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    ).length;
  }, [baseFilteredTasks, searchQuery]);
  */

  const leadTimeStats = useMemo(() => {
    let early = 0;
    let onTime = 0;
    let late = 0;
    let totalDiff = 0;
    let count = 0;
    baseFilteredTasks.forEach((t) => {
      if (t.status === "completed" && t.completed && t.due) {
        const c = new Date(t.completed);
        const d = new Date(t.due);
        const diffDays = (d.getTime() - c.getTime()) / (1000 * 60 * 60 * 24);
        totalDiff += diffDays;
        count++;
        if (diffDays >= 1) early++;
        else if (diffDays >= -1) onTime++;
        else late++;
      }
    });
    return {
      averageLeadTime: count === 0 ? 0 : totalDiff / count,
      onTimeTasks: early + onTime,
      lateTasks: late,
    };
  }, [baseFilteredTasks]);

  const calendarTasks = useMemo(() => baseFilteredTasks, [baseFilteredTasks]);

  const flatNavTasks = useMemo(() => {
    if (activeTab === "active") return activeGroups.flatMap((g) => g.tasks);
    if (activeTab === "history") return historyList;
    return [];
  }, [activeTab, activeGroups, historyList]);

  const isTypingInField = () => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  };

  useEffect(() => {
    if (periodModalTiltDeg === 0) return undefined;
    const t = setTimeout(() => setPeriodModalTiltDeg(0), 380);
    return () => clearTimeout(t);
  }, [periodModalPeriod, periodModalTiltDeg]);

  useEffect(() => {
    if (!keyboardFocusedTaskId) return;
    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const el = document.querySelector(
      `[data-task-row-id="${esc(keyboardFocusedTaskId)}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [keyboardFocusedTaskId, flatNavTasks]);

  useEffect(() => {
    // Avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setKeyboardFocusedTaskId((prev) => {
        if (!prev) return null;
        if (flatNavTasks.some((t) => t.id === prev)) return prev;
        return null;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [flatNavTasks]);

  useEffect(() => {
    if (activeTab !== "active" && activeTab !== "history") {
      const timer = setTimeout(() => {
        setKeyboardFocusedTaskId(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Shift") {
        setShiftHeld(true);
        return;
      }

      if (!accessToken && !isDemo) return;

      if (isTypingInField()) return;

      if (periodModalPeriod) {
        if (e.key === "Escape") {
          e.preventDefault();
          setPeriodModalPeriod(null);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const i = PERIOD_MODAL_ORDER.indexOf(periodModalPeriod);
          setPeriodModalTiltDeg(-14);
          // 安全な配列アクセスのためのモジュロ計算修正
          setPeriodModalPeriod(
            PERIOD_MODAL_ORDER[
            (i - 1 + PERIOD_MODAL_ORDER.length) % PERIOD_MODAL_ORDER.length
            ]
          );
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const i = PERIOD_MODAL_ORDER.indexOf(periodModalPeriod);
          setPeriodModalTiltDeg(14);
          setPeriodModalPeriod(
            PERIOD_MODAL_ORDER[(i + 1) % PERIOD_MODAL_ORDER.length]
          );
          return;
        }
        // ▼ 追加: モーダル表示中は背面のリストに対するショートカットを完全にブロック
        return;
      }

      if (e.key === "Escape") {
        if (selectedTag != null) {
          e.preventDefault();
          setSelectedTag(null);
          return;
        }
        if (keyboardFocusedTaskId) {
          e.preventDefault();
          setKeyboardFocusedTaskId(null);
        }
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        const tagRow = tagStats[n - 1];
        if (tagRow) {
          e.preventDefault();
          setSelectedTag(tagRow.tag);
        }
        return;
      }

      if (activeTab !== "active" && activeTab !== "history") return;
      if (loading) return;

      if (e.key === "ArrowDown") {
        if (!flatNavTasks || flatNavTasks.length === 0) return;
        e.preventDefault();
        setKeyboardFocusedTaskId((prev) => {
          if (!prev) return flatNavTasks[0].id;
          const i = flatNavTasks.findIndex((t) => t.id === prev);
          const next = i < 0 ? 0 : Math.min(i + 1, flatNavTasks.length - 1);
          return flatNavTasks[next].id;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        if (!flatNavTasks || flatNavTasks.length === 0) return;
        e.preventDefault();
        setKeyboardFocusedTaskId((prev) => {
          if (!prev) return flatNavTasks[0].id;
          const i = flatNavTasks.findIndex((t) => t.id === prev);
          const next = i < 0 ? 0 : Math.max(i - 1, 0);
          return flatNavTasks[next].id;
        });
        return;
      }

      if (e.key === "Enter") {
        if (!flatNavTasks || flatNavTasks.length === 0) return;
        const id = keyboardFocusedTaskId;
        if (!id) return;
        const task = flatNavTasks.find((t) => t.id === id);
        if (task) {
          e.preventDefault();
          toggleTaskStatus(task);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    PERIOD_MODAL_ORDER,
    periodModalPeriod,
    selectedTag,
    activeTab,
    loading,
    flatNavTasks,
    keyboardFocusedTaskId,
    tagStats,
    toggleTaskStatus,
    accessToken,
    isDemo,
  ]);

  // === マウス連動アニメーションの座標追従 ===
  useEffect(() => {
    if (uiConfig.mouseEffect !== "glow") return;
    const handleMouseMove = (e) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [uiConfig.mouseEffect]);

  // === サイドバーのハイライト追従 ===
  useEffect(() => {
    if (!sidebarNavRef.current) return;
    const activeEl = sidebarNavRef.current.querySelector(
      `[data-menu-val="${activeTab}"]`
    );
    if (activeEl) {
      setNavHighlightStyle({
        top: activeEl.offsetTop,
        height: activeEl.offsetHeight,
        opacity: 1,
        ready: true,
      });
    }
  }, [activeTab]);

  const getTagColor = (tag) => {
    const s = String(tag || "");
    const colors = [
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    ];
    let hash = 0;
    for (let i = 0; i < s.length; i++)
      hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // const scrollAreaRef = useRef(null);

  const showLoginScreen = !accessToken && !isDemo && tasks.length === 0;

  if (showLoginScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-800 p-6 text-center">
            <LayoutDashboard className="mx-auto text-white mb-3" size={40} />
            <h1 className="text-2xl font-bold text-white">Task Dashboard</h1>
            <p className="text-slate-300 text-sm mt-1">
              タグ分類＆達成率分析付き ToDo
            </p>
          </div>
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
                <AlertCircle className="shrink-0 mt-0.5" size={14} />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleAuth}
                disabled={loading}
                className={`w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${loading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
              >
                {loading ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <Play size={20} />
                )}
                Google でログイン
              </button>
              <button
                onClick={loadDemo}
                disabled={loading}
                className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition flex items-center justify-center gap-2 shadow-sm"
              >
                デモデータで試す
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClientIdOverrideOpen(!clientIdOverrideOpen)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition mx-auto"
              >
                {clientIdOverrideOpen ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                Client ID の設定
              </button>

              {clientIdOverrideOpen && (
                <div className="mt-3 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Google Cloud Console で作成した「Web アプリケーション」の
                    Client ID を入力してください。
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Client ID を入力..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      onClick={() => {
                        localStorage.setItem(
                          "google_tasks_client_id",
                          clientId
                        );
                        setError("Client IDを保存しました。再開してください。");
                      }}
                      className="px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition"
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDark = ["dark", "navy", "pitchBlack"].includes(uiConfig.bgTheme);
  const animDur = uiConfig.animation === "off" ? "0s" : "0.3s";
  const animDurBg = uiConfig.animation === "off" ? "0s" : "0.5s";

  let panelBg = tColors.panel;
  let panelBlur = "0px";

  // シャドウとボーダーの変数化
  const shadowVals = {
    none: "none",
    sm: "0 1px 3px rgba(0,0,0,0.05)",
    md: "0 4px 6px -1px rgba(0,0,0,0.1)",
    lg: "0 10px 15px -3px rgba(0,0,0,0.1)",
  };
  const borderVals = {
    none: "none",
    thin: `1px solid ${tColors.border}`,
    thick: `2px solid ${tColors.text}`,
  };

  let panelShadow = isDark ? "none" : shadowVals[uiConfig.shadow];
  let panelBorder = borderVals[uiConfig.border];
  let panelBackdropFilter = `blur(${panelBlur})`;
  let panelBoxShadowInset = "";

  if (uiConfig.texture === "glass") {
    panelBg = isDark ? "rgba(15, 23, 42, 0.45)" : "rgba(255, 255, 255, 0.5)";
    panelBlur = "40px";
    panelShadow = isDark
      ? "0 8px 32px rgba(0,0,0,0.5)"
      : "0 8px 32px rgba(31, 38, 135, 0.1)";
    panelBorder = isDark
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid rgba(255,255,255,0.5)";
    panelBoxShadowInset = isDark
      ? "inset 0 1px 0 rgba(255,255,255,0.1)"
      : "inset 0 1px 0 rgba(255,255,255,0.8)";
    panelBackdropFilter = `blur(${panelBlur}) saturate(150%)`;
  } else if (uiConfig.texture === "simple") {
    panelShadow = "none";
    panelBorder = borderVals[uiConfig.border];
  } else if (uiConfig.texture === "paper") {
    panelBg = tColors.panel;
    panelShadow = isDark
      ? "0 2px 4px rgba(0,0,0,0.5)"
      : "0 1px 3px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.5)";
  } else if (uiConfig.texture === "neon") {
    panelBorder = `1px solid ${uiColors.dark}`;
    panelShadow = `0 0 15px ${uiColors.main}60, inset 0 0 8px ${uiColors.main}30`;
  }
  if (panelBoxShadowInset) {
    panelShadow =
      panelShadow !== "none"
        ? `${panelShadow}, ${panelBoxShadowInset}`
        : panelBoxShadowInset;
  }

  const appBgColor =
    uiConfig.texture === "glass"
      ? `linear-gradient(135deg, ${tColors.bg} 0%, ${isDark ? "#000000" : uiColors.light
      } 100%)`
      : tColors.bg;

  return (
    <div
      className="h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{
        fontFamily: fontMap[uiConfig.font],
        background: appBgColor,
        color: tColors.text,
        fontWeight: currentWeight.base,
        transition: `background-color ${animDurBg}, color ${animDurBg}`,
      }}
    >
      {uiConfig.mouseEffect === "glow" && (
        <div
          className="pointer-events-none fixed inset-0 z-[100] transition-opacity duration-500"
          style={{
            background: `radial-gradient(800px circle at var(--mouse-x, 50vw) var(--mouse-y, 50vh), var(--ui-accent-light), transparent 40%)`,
            opacity: isDark ? 0.08 : 0.4,
            mixBlendMode: isDark ? "screen" : "multiply",
          }}
        />
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=JetBrains+Mono:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700;900&family=Noto+Sans+JP:wght@300;400;500;700;900&family=Noto+Serif+JP:wght@300;400;700;900&family=Shippori+Mincho+B1:wght@400;500;700;800&family=Zen+Kaku+Gothic+Antique:wght@400;500;700;900&family=Zen+Old+Mincho:wght@400;700;900&display=swap');
        
        @keyframes page-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes page-slide { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes page-spring { 
          0% { opacity: 0; transform: translateY(25px) scale(0.96); } 
          60% { opacity: 1; transform: translateY(-3px) scale(1.01); } 
          100% { opacity: 1; transform: translateY(0) scale(1); } 
        }
        
        :root {
          --ui-accent: ${uiColors.main};
          --ui-accent-dark: ${uiColors.dark};
          --ui-accent-light: ${isDark ? uiColors.dark + "40" : uiColors.light};
          --ui-accent-border: ${isDark ? uiColors.main + "80" : uiColors.border
        };
          --ui-accent-contrast: ${uiColors.contrast};
          --ui-radius: ${radiusMap[uiConfig.radius]};
          --ui-font: ${fontMap[uiConfig.font]};
          --ui-weight-base: ${currentWeight.base};
          --ui-weight-medium: ${currentWeight.medium};
          --ui-weight-bold: ${currentWeight.bold};
          --ui-weight-black: ${currentWeight.black};
          --ui-text: ${tColors.text};
          --ui-text-muted: ${tColors.textMuted};
          --ui-transition: ${animDur};
          --ui-icon-weight: ${uiConfig.iconWeight === "light"
          ? "1.25"
          : uiConfig.iconWeight === "bold"
            ? "2.75"
            : "2"
        };
          --ui-density-gap: ${densityValues[uiConfig.density].gap};
          --ui-density-p: ${densityValues[uiConfig.density].p};
          --ui-bg: ${tColors.bg};
          --ui-panel-bg: ${panelBg};
          --ui-border: ${tColors.border};
          
          --ui-danger: ${isDark ? "#f43f5e" : "#e11d48"};
          --ui-danger-bg: ${isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(225, 29, 72, 0.08)"
        };
          --ui-success: ${isDark ? "#10b981" : "#059669"};
          --ui-success-bg: ${isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(5, 150, 105, 0.08)"
        };
          --ui-warning: ${isDark ? "#f59e0b" : "#d97706"};
          --ui-warning-bg: ${isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(217, 119, 6, 0.08)"
        };

          /* 新規追加：透過背景やタグ用のセマンティックカラー */
          --ui-hover: ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)"
        };
          --ui-hover-active: ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
        };
          --ui-backdrop: ${isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.2)"
        };
          --ui-skeleton: ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
        };

          --tag-1-text: ${isDark ? "#60a5fa" : "#2563eb"};
          --tag-1-bg: ${isDark ? "rgba(96, 165, 250, 0.15)" : "rgba(37, 99, 235, 0.1)"
        };
          --tag-1-border: ${isDark ? "rgba(96, 165, 250, 0.3)" : "rgba(37, 99, 235, 0.2)"
        };
          --tag-2-text: ${isDark ? "#34d399" : "#059669"};
          --tag-2-bg: ${isDark ? "rgba(52, 211, 153, 0.15)" : "rgba(5, 150, 105, 0.1)"
        };
          --tag-2-border: ${isDark ? "rgba(52, 211, 153, 0.3)" : "rgba(5, 150, 105, 0.2)"
        };
          --tag-3-text: ${isDark ? "#a78bfa" : "#7c3aed"};
          --tag-3-bg: ${isDark ? "rgba(167, 139, 250, 0.15)" : "rgba(124, 58, 237, 0.1)"
        };
          --tag-3-border: ${isDark ? "rgba(167, 139, 250, 0.3)" : "rgba(124, 58, 237, 0.2)"
        };
          --tag-4-text: ${isDark ? "#fbbf24" : "#d97706"};
          --tag-4-bg: ${isDark ? "rgba(251, 191, 36, 0.15)" : "rgba(217, 119, 6, 0.1)"
        };
          --tag-4-border: ${isDark ? "rgba(251, 191, 36, 0.3)" : "rgba(217, 119, 6, 0.2)"
        };
          --tag-5-text: ${isDark ? "#fb7185" : "#e11d48"};
          --tag-5-bg: ${isDark ? "rgba(251, 113, 133, 0.15)" : "rgba(225, 29, 72, 0.1)"
        };
          --tag-5-border: ${isDark ? "rgba(251, 113, 133, 0.3)" : "rgba(225, 29, 72, 0.2)"
        };
          --tag-6-text: ${isDark ? "#22d3ee" : "#0891b2"};
          --tag-6-bg: ${isDark ? "rgba(34, 211, 238, 0.15)" : "rgba(8, 145, 178, 0.1)"
        };
          --tag-6-border: ${isDark ? "rgba(34, 211, 238, 0.3)" : "rgba(8, 145, 178, 0.2)"
        };
        }

        html, body { overflow: hidden; width: 100%; height: 100%; }

        * { transition-duration: var(--ui-transition) !important; transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1) !important; }
        svg.lucide { stroke-width: var(--ui-icon-weight) !important; }
        .font-normal { font-weight: var(--ui-weight-base) !important; }
        .font-medium { font-weight: var(--ui-weight-medium) !important; }
        .font-bold, .font-semibold { font-weight: var(--ui-weight-bold) !important; }
        .font-black { font-weight: var(--ui-weight-black) !important; }
        
        .bg-white, .bg-slate-50, .bg-slate-100, .bg-slate-800 {
          background: ${panelBg} !important;
          backdrop-filter: ${panelBackdropFilter} !important;
          -webkit-backdrop-filter: ${panelBackdropFilter} !important;
          box-shadow: ${panelShadow} !important;
          border: ${panelBorder} !important;
          color: var(--ui-text) !important;
          ${uiConfig.texture === "paper"
          ? `background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");`
          : ""
        }
        }

        input, textarea { background-color: ${isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.9)"
        } !important; color: var(--ui-text) !important; border-color: ${tColors.border
        } !important; }

        .ui-gradient-card { background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-dark) 100%) !important; color: var(--ui-accent-contrast) !important; border: none !important; }
        .ui-gradient-card p, .ui-gradient-card span, .ui-gradient-card div { color: var(--ui-accent-contrast) !important; opacity: 0.95; }
        .ui-gradient-card svg { color: var(--ui-accent-contrast) !important; opacity: 0.5; }

        .ui-fab { background-color: var(--ui-accent) !important; color: var(--ui-accent-contrast) !important; box-shadow: 0 10px 25px -5px var(--ui-accent-border), 0 8px 10px -6px var(--ui-accent-border) !important; border: none !important; }

        .ui-panel { padding: var(--ui-density-p) !important; }
        .ui-layout-gap { gap: var(--ui-density-gap) !important; }
        .rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl { border-radius: var(--ui-radius) !important; }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background-color: ${isDark ? "#334155" : "var(--ui-accent-border)"
        }; border-radius: var(--ui-radius); border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background-color: var(--ui-accent); }

        .ui-highlight-bg { background-color: var(--ui-text) !important; opacity: 0.08 !important; border:none !important; }
      `}</style>

      {error && !showLoginScreen && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-4">
          <AlertCircle size={16} />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 p-1 hover:bg-red-200 rounded-full"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <header
        className="border-b z-30 shrink-0 xl:hidden"
        style={{ background: panelBg, backdropFilter: panelBackdropFilter }}
      >
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 xl:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <LayoutDashboard style={{ color: "var(--ui-accent)" }} size={24} />
            <h1
              className="font-bold text-lg hidden sm:block"
              style={{ color: "var(--ui-text)" }}
            >
              Task Dashboard
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 sm:gap-4 shrink-0 ml-auto">
            {!accessToken && !isDemo && tasks.length > 0 && (
              <button
                onClick={handleAuth}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition flex items-center gap-1"
              >
                <AlertCircle size={14} /> 再接続
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || (!accessToken && !isDemo)}
              className="p-2 rounded-full transition disabled:opacity-50 hover:bg-black/5 dark:hover:bg-white/10"
              style={{ color: "var(--ui-text)" }}
            >
              <RefreshCw
                size={20}
                className={
                  loading ? "animate-spin" : "opacity-70 hover:opacity-100"
                }
              />
            </button>
          </div>
          {!accessToken && !isDemo && tasks.length > 0 && (
            <button
              onClick={handleAuth}
              className="xl:hidden ml-auto text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700 flex items-center gap-1"
            >
              再接続
            </button>
          )}
          <button
            type="button"
            className={`xl:hidden p-2 rounded-lg transition relative w-10 h-10 flex flex-col justify-center items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10 ${!accessToken && !isDemo && tasks.length > 0 ? "" : "ml-auto"
              } group`}
            style={{ color: "var(--ui-text)" }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span
              className={`block w-6 h-0.5 bg-current transition-all duration-300 origin-center ${isMobileMenuOpen
                  ? "rotate-[45deg] translate-y-[8px]"
                  : "group-hover:-translate-y-0.5"
                }`}
              style={{
                transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
            <span
              className={`block w-6 h-0.5 bg-current transition-all duration-200 ${isMobileMenuOpen ? "opacity-0 scale-x-0" : "opacity-100"
                }`}
            />
            <span
              className={`block w-6 h-0.5 bg-current transition-all duration-300 origin-center ${isMobileMenuOpen
                  ? "-rotate-[45deg] -translate-y-[8px]"
                  : "group-hover:translate-y-0.5"
                }`}
              style={{
                transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          </button>
        </div>
      </header>

      {/* ── Mobile Menu Panel ── */}
      {isMobileMenuOpen && (
        <div
          className="xl:hidden fixed inset-0 z-40 flex flex-col"
          style={{ top: "4rem" }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Slide-down panel */}
          <div
            className="relative z-10 overflow-y-auto flex-1 animate-in slide-in-from-top-2 shadow-2xl"
            style={{
              background: panelBg,
              backdropFilter: `blur(${panelBlur})`,
            }}
          >
            {/* Navigation items */}
            <div
              className="p-4 border-b"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 px-1">
                Menu
              </p>
              <nav className="space-y-0.5">
                {[
                  {
                    value: "active",
                    icon: Circle,
                    label: t("active", uiConfig.language),
                  },
                  {
                    value: "history",
                    icon: History,
                    label: t("history", uiConfig.language),
                  },
                  {
                    value: "calendar",
                    icon: Calendar,
                    label: t("calendar", uiConfig.language),
                  },
                  {
                    value: "analytics",
                    icon: BarChart3,
                    label: t("analytics", uiConfig.language),
                  },
                  {
                    value: "organize",
                    icon: Layers,
                    label: t("organize", uiConfig.language),
                  },
                  {
                    value: "settings",
                    icon: Settings,
                    label: t("settings", uiConfig.language),
                  },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setActiveTab(value);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-left flex items-center gap-3 font-medium transition ${activeTab === value
                        ? "bg-[var(--ui-accent-light)] text-[var(--ui-accent)]"
                        : "text-[var(--ui-text)] hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                  >
                    <Icon
                      size={18}
                      className={
                        activeTab === value
                          ? "text-[var(--ui-accent)]"
                          : "opacity-60"
                      }
                    />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tag filter */}
            <div
              className="p-4 border-b"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2 px-1">
                タグフィルター
              </p>
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setSelectedTag(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-sm flex justify-between items-center transition ${selectedTag === null
                      ? "text-[var(--ui-accent)] font-bold bg-[var(--ui-accent-light)]"
                      : "text-[var(--ui-text-muted)] hover:bg-black/5"
                    }`}
                >
                  <span>すべて</span>
                  <span className="text-[10px] opacity-60">
                    ({stats.total})
                  </span>
                </button>
                {tagStats.map((tData) => (
                  <button
                    key={tData.tag}
                    onClick={() => {
                      setSelectedTag((prev) =>
                        prev === tData.tag ? null : tData.tag
                      );
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-sm flex justify-between items-center transition ${selectedTag === tData.tag
                        ? "text-[var(--ui-accent)] font-bold bg-[var(--ui-accent-light)]"
                        : "text-[var(--ui-text-muted)] hover:bg-black/5"
                      }`}
                  >
                    <span className="truncate pr-2">{tData.tag}</span>
                    <span className="text-[10px] shrink-0 font-bold">
                      {tData.active > 0 ? tData.active : "✓"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 flex flex-col gap-3 pb-8">
              {!accessToken && !isDemo && tasks.length > 0 && (
                <button
                  onClick={() => {
                    handleAuth();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 text-sm font-bold rounded-xl border flex items-center justify-center gap-2 transition bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                >
                  <AlertCircle size={15} /> 再接続 (セッション切れ)
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleRefresh();
                    setIsMobileMenuOpen(false);
                  }}
                  disabled={loading || (!accessToken && !isDemo)}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl border flex items-center justify-center gap-2 transition hover:bg-black/5 disabled:opacity-50"
                  style={{
                    borderColor: "var(--ui-border)",
                    color: "var(--ui-text)",
                  }}
                >
                  <RefreshCw
                    size={15}
                    className={loading ? "animate-spin" : ""}
                  />{" "}
                  更新
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl border flex items-center justify-center gap-2 transition hover:bg-red-500/10"
                  style={{
                    borderColor: "rgba(239,68,68,0.4)",
                    color: "#ef4444",
                  }}
                >
                  <LogOut size={15} /> 切断
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden w-full max-w-[100rem] mx-auto ui-layout-gap min-w-0">
        {/* --- 左サイドバー (統合版) --- */}
        <aside className="hidden xl:flex flex-col w-[260px] 2xl:w-[280px] shrink-0 ui-layout-gap overflow-y-auto hide-scrollbar pb-6 pt-6 pl-8 relative">
          {/* 1. Menu */}
          <div className="bg-white rounded-xl shadow-sm border ui-panel shrink-0">
            <h2 className="text-sm font-bold opacity-80 mb-3 flex items-center gap-2 uppercase tracking-wide">
              {uiConfig.iconStyle !== "text" && <LayoutDashboard size={16} />}{" "}
              Menu
            </h2>
            <nav ref={sidebarNavRef} className="flex flex-col gap-2 relative">
              <div
                className="absolute left-0 right-0 rounded-lg pointer-events-none ui-highlight-bg"
                style={{
                  top: navHighlightStyle.top,
                  height: navHighlightStyle.height,
                  opacity: navHighlightStyle.opacity,
                  transition: navHighlightStyle.ready
                    ? "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)"
                    : "none",
                  backgroundColor: "var(--ui-text)",
                  border: "none",
                }}
              />
              {[
                {
                  value: "active",
                  icon: Circle,
                  textIcon: "ACT",
                  label: t("active", uiConfig.language),
                },
                {
                  value: "history",
                  icon: History,
                  textIcon: "HIS",
                  label: t("history", uiConfig.language),
                },
                {
                  value: "calendar",
                  icon: Calendar,
                  textIcon: "CAL",
                  label: t("calendar", uiConfig.language),
                },
                {
                  value: "analytics",
                  icon: BarChart3,
                  textIcon: "ANA",
                  label: t("analytics", uiConfig.language),
                },
                {
                  value: "organize",
                  icon: Layers,
                  textIcon: "ORG",
                  label: t("organize", uiConfig.language),
                },
                {
                  value: "settings",
                  icon: Settings,
                  textIcon: "SET",
                  label: t("settings", uiConfig.language),
                },
              ].map(({ value, label, textIcon, icon: Icon }) => {
                const isActive = activeTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    data-menu-val={value}
                    onClick={() => setActiveTab(value)}
                    className={`px-3 py-2 rounded-lg text-sm transition relative z-10 flex items-center gap-2 ${isActive
                        ? "text-[var(--ui-accent)] font-bold"
                        : "text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--ui-text)]"
                      }`}
                  >
                    {uiConfig.iconStyle === "text" ? (
                      <span className="font-mono font-bold text-xs">
                        [{textIcon}]
                      </span>
                    ) : (
                      <Icon size={16} />
                    )}
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 2. Search */}
          <div className="w-full relative shrink-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
              style={{ color: "var(--ui-text)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search", uiConfig.language)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border shadow-sm outline-none focus:ring-2 transition-all text-sm"
              style={{
                borderColor: "var(--ui-border)",
                "--tw-ring-color": "var(--ui-accent)",
                background: "var(--ui-panel-bg)",
                color: "var(--ui-text)",
              }}
            />
          </div>

          {/* 3. Filter (Tags / Routines) */}
          <div className="bg-white rounded-xl shadow-sm border ui-panel flex flex-col flex-1 min-h-[250px]">
            <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 mb-3 shrink-0">
              <button
                onClick={() => setSidebarFilterTab("tags")}
                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition ${sidebarFilterTab === "tags"
                    ? "bg-[var(--ui-panel-bg)] text-[var(--ui-text)] shadow-sm"
                    : "text-[var(--ui-text-muted)] opacity-70"
                  }`}
              >
                Tags
              </button>
              <button
                onClick={() => setSidebarFilterTab("routines")}
                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition ${sidebarFilterTab === "routines"
                    ? "bg-[var(--ui-panel-bg)] text-[var(--ui-text)] shadow-sm"
                    : "text-[var(--ui-text-muted)] opacity-70"
                  }`}
              >
                Routines
              </button>
            </div>

            {/* min-h-0 を追加してflex要素の潰れを防止 */}
            <div className="flex-1 overflow-y-auto pr-1 hide-scrollbar flex flex-col gap-1.5 min-h-0">
              {sidebarFilterTab === "tags" ? (
                <>
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${selectedTag === null
                        ? "text-[var(--ui-accent)] font-bold bg-[var(--ui-accent-light)]"
                        : "text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                  >
                    {t("all", uiConfig.language)} ({stats.total})
                  </button>
                  {tagStats.map((tData) => (
                    <button
                      key={tData.tag}
                      onClick={() =>
                        setSelectedTag((prev) =>
                          prev === tData.tag ? null : tData.tag
                        )
                      }
                      className={`shrink-0 px-3 py-2 rounded-lg text-sm transition relative overflow-hidden flex flex-col group ${selectedTag === tData.tag
                          ? "text-[var(--ui-accent)] font-bold bg-[var(--ui-accent-light)]"
                          : "text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                    >
                      <div className="flex justify-between items-center w-full relative z-10">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${tData.tag === "未分類"
                                ? "bg-slate-300"
                                : getTagColor(tData.tag)
                                  .split(" ")[0]
                                  .replace("/10", "")
                              }`}
                          />
                          <span className="text-sm font-medium truncate">
                            {tData.tag}
                          </span>
                        </div>
                        <span
                          className="text-[10px] bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-full shrink-0 font-bold"
                          title="7日以内のタスク数"
                        >
                          {tData.active7Days > 0 ? tData.active7Days : "0"}
                        </span>
                      </div>
                      <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1 mt-1.5 relative z-10 overflow-hidden">
                        <div
                          className={`h-1 rounded-full ${tData.rate === 100
                              ? "bg-[var(--ui-success)]"
                              : "bg-[var(--ui-accent)] opacity-70"
                            }`}
                          style={{ width: `${tData.rate}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedRoutine(null)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${selectedRoutine === null
                        ? "text-[var(--ui-accent)] font-bold bg-[var(--ui-accent-light)]"
                        : "text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                  >
                    {t("all", uiConfig.language)}
                  </button>
                  {routineGroups.map((g) => (
                    <button
                      key={g.titleLabel}
                      onClick={() =>
                        setSelectedRoutine((prev) =>
                          prev === g.titleLabel ? null : g.titleLabel
                        )
                      }
                      className={`shrink-0 px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${selectedRoutine === g.titleLabel
                          ? "text-[var(--ui-accent)] font-bold bg-[var(--ui-accent-light)]"
                          : "text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                    >
                      <span className="truncate relative z-10">
                        {g.titleLabel}
                      </span>
                      <span className="text-[10px] bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded-full shrink-0 relative z-10">
                        {g.activeCount > 0 ? g.activeCount : "✓"}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 4. Actions (Refresh / Logout) - コンパクト化 */}
          <div className="flex flex-col gap-2 shrink-0">
            {!accessToken && !isDemo && tasks.length > 0 && (
              <button
                onClick={handleAuth}
                className="w-full rounded-xl shadow-sm border border-amber-200 bg-amber-50 text-amber-700 flex items-center justify-center gap-1.5 py-2 hover:bg-amber-100 transition text-xs font-bold"
              >
                <AlertCircle size={14} /> セッション切れ (再接続)
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading || (!accessToken && !isDemo)}
                className="flex-1 rounded-xl shadow-sm border flex items-center justify-center gap-1.5 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition text-xs font-bold disabled:opacity-50"
                style={{
                  color: "var(--ui-text)",
                  borderColor: "var(--ui-border)",
                  background: "var(--ui-panel-bg)",
                }}
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />{" "}
                {t("refresh", uiConfig.language)}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-1.5 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-xs font-bold text-red-500"
                style={{ background: "var(--ui-panel-bg)" }}
              >
                <LogOut size={14} /> {t("logout", uiConfig.language)}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar pb-32 pt-4 sm:pt-6 px-4 sm:px-6 xl:pr-8 flex flex-col ui-layout-gap w-full h-full relative min-w-0">
          <div
            key={`${activeTab}-${selectedTag || "all"}-${selectedRoutine || "all"
              }`}
            className={`page-transition-${uiConfig.animation} w-full flex flex-col ui-layout-gap min-w-0`}
          >
            {(activeTab === "active" || activeTab === "history") && (
              <div className="xl:hidden w-full relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
                  style={{ color: "var(--ui-text)" }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("search", uiConfig.language)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-white shadow-sm outline-none focus:ring-2 transition-all text-sm"
                  style={{
                    borderColor: "var(--ui-border)",
                    "--tw-ring-color": "var(--ui-accent)",
                    background: "var(--ui-panel-bg)",
                  }}
                />
              </div>
            )}

            {["active", "history", "analytics"].includes(activeTab) && (
              <div className="relative group w-full">
                {/* 左スクロールボタン (xl以上の画面では全て収まるため非表示にする) */}
                <button
                  onClick={() => handleTopCardsScroll("left")}
                  className="hidden sm:flex xl:hidden absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 items-center justify-center rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
                  style={{
                    background: "var(--ui-panel-bg)",
                    color: "var(--ui-text)",
                    border: "1px solid var(--ui-border)",
                  }}
                >
                  <ChevronLeft size={18} />
                </button>

                <div
                  ref={topCardsScrollRef}
                  /* 影が上下で切れないように pt-2 pb-6 で十分な余白を確保 */
                  className="-mx-4 xl:mx-0 px-4 xl:px-0 w-[calc(100%+2rem)] xl:w-full overflow-x-auto hide-scrollbar pt-2 pb-6"
                >
                  {/* xl以上でスクロールを解除し、フレックス幅で画面幅いっぱいに広げる */}
                  <div className="flex gap-3 w-max xl:w-full snap-x snap-mandatory after:content-[''] after:w-4 after:shrink-0 xl:after:hidden">
                    {/* w-[85vw] をやめてスマホでの極端な肥大化を防止 */}
                    <div className="snap-center shrink-0 w-[260px] sm:w-[320px] lg:w-[400px] xl:w-auto xl:flex-1 ui-gradient-card ui-panel rounded-xl relative overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between min-h-[120px]">
                      {/* (Internal content) */}
                      <div className="relative z-10 text-white">
                        <p className="text-sm font-bold mb-1 flex items-center gap-1.5">
                          {uiConfig.iconStyle !== "text" && (
                            <TrendingUp size={16} />
                          )}{" "}
                          {t("weeklyProgress", uiConfig.language)}
                        </p>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-4xl font-black">
                            {weeklyStats.rate}
                          </span>
                          <span className="text-lg font-bold">%</span>
                        </div>
                        <p className="text-xs mt-2 font-medium opacity-80">
                          {weeklyStats.totalTarget === 0
                            ? "-"
                            : `${t("completed", uiConfig.language)} ${weeklyStats.completed
                            } / ${t("total", uiConfig.language)} ${weeklyStats.totalTarget
                            }`}
                        </p>
                      </div>
                      {uiConfig.widgetDecor === "target" && (
                        <Target
                          className="absolute -right-4 -bottom-4 opacity-10 text-white"
                          size={100}
                        />
                      )}
                      {uiConfig.widgetDecor === "sparkle" && (
                        <Sparkles
                          className="absolute right-2 bottom-2 text-white opacity-25"
                          size={64}
                          strokeWidth={1.5}
                        />
                      )}
                      {uiConfig.widgetDecor === "neon" && (
                        <div className="absolute right-0 bottom-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-20 mix-blend-overlay" />
                      )}
                    </div>
                    {/* その他のカードもスマホ時は w-[150px] に固定し、スクロールさせる */}
                    <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-[260px] xl:w-auto xl:flex-1">
                      <PeriodCard
                        label={t("thisWeek", uiConfig.language)}
                        icon={
                          uiConfig.iconStyle !== "text" && <Calendar size={14} />
                        }
                        stats={weeklyStats}
                        accent="text-[var(--ui-accent)]"
                        onClick={() => {
                          setPeriodModalTiltDeg(0);
                          setPeriodModalPeriod("week");
                        }}
                      />
                    </div>
                    <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-[260px] xl:w-auto xl:flex-1">
                      <PeriodCard
                        label={t("nextWeek", uiConfig.language)}
                        icon={
                          uiConfig.iconStyle !== "text" && <Calendar size={14} />
                        }
                        stats={nextWeekStats}
                        accent="text-[var(--ui-accent-dark)]"
                        onClick={() => {
                          setPeriodModalTiltDeg(0);
                          setPeriodModalPeriod("nextWeek");
                        }}
                      />
                    </div>
                    <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-[260px] xl:w-auto xl:flex-1">
                      <PeriodCard
                        label={t("thisMonth", uiConfig.language)}
                        icon={
                          uiConfig.iconStyle !== "text" && <Calendar size={14} />
                        }
                        stats={monthStats}
                        accent="text-[var(--ui-accent-dark)] opacity-70"
                        onClick={() => {
                          setPeriodModalTiltDeg(0);
                          setPeriodModalPeriod("month");
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 右スクロールボタン */}
                <button
                  onClick={() => handleTopCardsScroll("right")}
                  className="hidden sm:flex xl:hidden absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 items-center justify-center rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
                  style={{
                    background: "var(--ui-panel-bg)",
                    color: "var(--ui-text)",
                    border: "1px solid var(--ui-border)",
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            {activeTab === "active" && (
              <>
                {taskFormExpanded ? (
                  <div
                    className="bg-white rounded-xl shadow-lg border p-4 animate-in slide-in-from-bottom-4"
                    style={{
                      borderColor: "var(--ui-border)",
                      background: "var(--ui-panel-bg)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="text-sm font-bold opacity-80"
                          style={{ color: "var(--ui-text)" }}
                        >
                          タスク追加
                        </span>
                        <button
                          type="button"
                          onClick={copyAiPrompt}
                          className="text-[10px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 transition"
                          style={{
                            backgroundColor: "var(--ui-accent-light)",
                            color: "var(--ui-accent-dark)",
                          }}
                        >
                          <Sparkles size={12} /> AIプロンプト作成
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTaskFormExpanded(false)}
                        className="p-1 opacity-50 hover:opacity-100 transition"
                        style={{ color: "var(--ui-text)" }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <textarea
                      autoFocus
                      rows={4}
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder={
                        "タスクを入力...\n（例: [Univ] レポート作成, 2024-05-15）\n※改行で複数同時に入力できます"
                      }
                      className="w-full p-3 text-[16px] sm:text-sm rounded-lg border focus:ring-2 outline-none transition-all resize-y"
                      style={{
                        background: "var(--ui-bg)",
                        color: "var(--ui-text)",
                        borderColor: "var(--ui-border)",
                        "--tw-ring-color": "var(--ui-accent)",
                      }}
                    />

                    <div className="mt-3 flex flex-col sm:flex-row sm:items-start gap-3">
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1"
                        style={{
                          borderColor: "var(--ui-border)",
                          background: "var(--ui-bg)",
                        }}
                      >
                        <Calendar
                          size={14}
                          className="opacity-50 shrink-0"
                          style={{ color: "var(--ui-text)" }}
                        />
                        <input
                          type="datetime-local"
                          value={newTaskDue}
                          onChange={(e) => setNewTaskDue(e.target.value)}
                          className="text-xs w-full bg-transparent outline-none cursor-pointer"
                          style={{
                            color: "var(--ui-text)",
                            colorScheme: isDark ? "dark" : "light",
                          }}
                        />
                        {newTaskDue && (
                          <button
                            type="button"
                            onClick={() => setNewTaskDue("")}
                            className="opacity-40 hover:opacity-100 shrink-0"
                            style={{ color: "var(--ui-text)" }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 flex-[2]">
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border min-h-[38px] flex-wrap"
                          style={{
                            borderColor: "var(--ui-border)",
                            background: "var(--ui-bg)",
                          }}
                        >
                          <Tag
                            size={14}
                            className="opacity-50 shrink-0"
                            style={{ color: "var(--ui-text)" }}
                          />
                          {newTaskTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium border"
                              style={{
                                backgroundColor: "var(--ui-accent-light)",
                                color: "var(--ui-accent-dark)",
                                borderColor: "var(--ui-accent-border)",
                              }}
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() =>
                                  setNewTaskTags((prev) =>
                                    prev.filter((t) => t !== tag)
                                  )
                                }
                                className="opacity-60 hover:opacity-100"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            placeholder="タグ入力 (Enterで追加)"
                            className="text-[16px] sm:text-xs bg-transparent outline-none flex-1 min-w-[100px] py-1"
                            style={{ color: "var(--ui-text)" }}
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = e.target.value.trim();
                                if (val && !newTaskTags.includes(val))
                                  setNewTaskTags([...newTaskTags, val]);
                                e.target.value = "";
                              }
                            }}
                          />
                        </div>
                        {tagStats.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap px-1">
                            {tagStats.slice(0, 8).map(
                              (t) =>
                                !newTaskTags.includes(t.tag) &&
                                t.tag !== "未分類" && (
                                  <button
                                    key={`sug-${t.tag}`}
                                    type="button"
                                    onClick={() =>
                                      setNewTaskTags((prev) => [...prev, t.tag])
                                    }
                                    className="text-[9px] px-1.5 py-0.5 rounded border opacity-60 hover:opacity-100 transition"
                                    style={{
                                      borderColor: "var(--ui-border)",
                                      color: "var(--ui-text)",
                                    }}
                                  >
                                    + {t.tag}
                                  </button>
                                )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex justify-between items-center mt-4 pt-4 border-t"
                      style={{ borderColor: "var(--ui-border)" }}
                    >
                      <p
                        className="text-[10px] opacity-50 hidden sm:block"
                        style={{ color: "var(--ui-text)" }}
                      >
                        ヒント: テキスト内の記法（[タグ] や
                        行末の日付）は、GUI設定を上書きします
                      </p>
                      <button
                        type="button"
                        onClick={handleAddTask}
                        className="px-6 py-2 rounded-lg font-bold shadow-md transition active:scale-95 text-sm ml-auto"
                        style={{
                          backgroundColor: "var(--ui-accent)",
                          color: "var(--ui-accent-contrast)",
                        }}
                      >
                        {loading ? "追加中..." : "タスクを一括登録"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {activeTab === "analytics" && (
              <AnalyticsView
                tasks={tasks}
                weeklyHistory={weeklyHistory}
                monthlyHistory={monthlyHistory}
                yearlyHistory={yearlyHistory}
                overallCompletionRate={overallCompletionRate}
                totalTasks={analyticsTotalTasks}
                completedTasks={analyticsCompletedTasks}
                tagStats={tagStats}
                selectedTag={selectedTag}
                toggleTaskStatus={toggleTaskStatus}
                uiConfig={uiConfig}
                t={t}
                setPeriodModalPeriod={setPeriodModalPeriod}
                setPeriodModalTiltDeg={setPeriodModalTiltDeg}
                weekBeforeLastStats={weekBeforeLastStats}
                lastWeekStats={lastWeekStats}
                weekAfterNextStats={weekAfterNextStats}
                nextMonthStats={nextMonthStats}
                monthAfterNextStats={monthAfterNextStats}
                {...leadTimeStats}
              />
            )}
            {activeTab === "calendar" && (
              <CalendarView
                tasks={calendarTasks}
                mode={calendarMode}
                setMode={setCalendarMode}
                cursor={calendarCursor}
                setCursor={setCalendarCursor}
                toggleTaskStatus={toggleTaskStatus}
                getTagColor={getTagColor}
              />
            )}
            {activeTab === "organize" && (
              <OrganizeView
                tasks={tasks}
                uiConfig={uiConfig}
                t={t}
                toggleTaskStatus={toggleTaskStatus}
                getTagColor={getTagColor}
                selectedTasks={selectedTasks}
                toggleSelection={toggleSelection}
                setSelectedTasks={setSelectedTasks}
                handleDeleteSelected={handleDeleteSelected}
                showCheckboxes={showCheckboxes}
                selectionMode={selectionMode}
                setSelectionMode={setSelectionMode}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
              />
            )}
            {activeTab === "settings" && (
              <UISettingsView
                uiConfig={uiConfig}
                setUiConfig={setUiConfig}
                tasks={tasks}
                accessToken={accessToken}
                fetchRealTasks={fetchRealTasks}
                isDemo={isDemo}
                handleLogout={handleLogout}
                handleAuth={handleAuth}
              />
            )}

            {(activeTab === "active" || activeTab === "history") && (
              <div
                className="bg-white rounded-xl shadow-sm border overflow-hidden"
                style={{ borderColor: "var(--ui-border)" }}
              >
                <div
                  className="px-3 py-1 border-b flex flex-wrap items-center justify-between gap-1.5"
                  style={{
                    borderColor: "var(--ui-border)",
                    background: "var(--ui-panel-bg)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectionMode((prev) => {
                        if (prev) setSelectedTasks(new Set());
                        return !prev;
                      });
                    }}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition border shrink-0 ${selectionMode
                        ? "bg-[var(--ui-text)] text-[var(--ui-bg)] shadow-sm"
                        : "bg-transparent text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    style={{ borderColor: "var(--ui-border)" }}
                  >
                    {selectionMode ? "選択終了" : "選択モード"}
                  </button>
                  <span className="text-[9px] opacity-60 text-right leading-tight flex-1 min-w-0 sm:max-w-[65%]">
                    1–9タグ · Escすべて · ↑↓ · Enter完了
                  </span>
                </div>
                <div
                  className="px-3 py-1.5 border-b flex justify-between items-center gap-2"
                  style={{
                    borderColor: "var(--ui-border)",
                    background: "var(--ui-bg)",
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5 min-w-0 shrink-0">
                      {selectedTag || selectedRoutine ? (
                        <>
                          <span className="opacity-40 shrink-0">
                            {selectedTag ? "#" : "Routine:"}
                          </span>{" "}
                          <span className="truncate">
                            {selectedTag || selectedRoutine}
                          </span>
                        </>
                      ) : activeTab === "active" ? (
                        "アクティブ"
                      ) : (
                        "完了履歴"
                      )}
                    </h2>

                    {/* 切り替えトグル */}
                    {(activeTab === "active" || activeTab === "history") &&
                      !selectedTag &&
                      !selectedRoutine && (
                        <div className="flex bg-black/5 dark:bg-white/5 rounded-md p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setDueFilter("all")}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition ${dueFilter === "all"
                                ? "bg-[var(--ui-panel-bg)] shadow-sm text-[var(--ui-text)]"
                                : "text-[var(--ui-text-muted)] opacity-70 hover:opacity-100"
                              }`}
                          >
                            すべて
                          </button>
                          <button
                            type="button"
                            onClick={() => setDueFilter("hasDue")}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition ${dueFilter === "hasDue"
                                ? "bg-[var(--ui-panel-bg)] shadow-sm text-[var(--ui-text)]"
                                : "text-[var(--ui-text-muted)] opacity-70 hover:opacity-100"
                              }`}
                          >
                            期限あり
                          </button>
                          <button
                            type="button"
                            onClick={() => setDueFilter("noDue")}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-sm transition ${dueFilter === "noDue"
                                ? "bg-[var(--ui-panel-bg)] shadow-sm text-[var(--ui-text)]"
                                : "text-[var(--ui-text-muted)] opacity-70 hover:opacity-100"
                              }`}
                          >
                            期限なし
                          </button>
                        </div>
                      )}
                  </div>
                  <span
                    className="text-[10px] font-medium opacity-60 px-1.5 py-0.5 rounded border shadow-sm shrink-0 tabular-nums"
                    style={{
                      borderColor: "var(--ui-border)",
                      background: "var(--ui-panel-bg)",
                    }}
                  >
                    {activeTab === "active"
                      ? activeTotalCount
                      : historyList.length}{" "}
                    件
                  </span>
                </div>

                {/* 洗練されたフローティング選択削除バー */}
                {selectedTasks.size > 0 && (
                  <div
                    className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-8 fade-in flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl border"
                    style={{
                      background: "var(--ui-panel-bg)",
                      borderColor: "var(--ui-border)",
                      backdropFilter: "blur(24px)",
                    }}
                  >
                    <span
                      className="text-xs sm:text-sm font-bold flex items-center gap-2"
                      style={{ color: "var(--ui-text)" }}
                    >
                      <span className="bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)] w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs shadow-sm">
                        {selectedTasks.size}
                      </span>
                      件選択中
                    </span>
                    <div className="w-px h-6 bg-black/10 dark:bg-white/10" />
                    <button
                      type="button"
                      onClick={() => setSelectedTasks(new Set())}
                      className="text-xs sm:text-sm font-bold opacity-50 hover:opacity-100 transition px-1"
                      style={{ color: "var(--ui-text)" }}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                    >
                      <Trash2 size={16} /> 削除する
                    </button>
                  </div>
                )}

                {loading ? (
                  <div className="p-12 text-center opacity-40 flex flex-col items-center">
                    <RefreshCw className="animate-spin mb-3" size={28} />
                    <p>読み込み中...</p>
                  </div>
                ) : (
                  activeTab === "active"
                    ? activeTotalCount === 0
                    : historyList.length === 0
                ) ? (
                  <div className="p-12 text-center opacity-40">
                    <CheckCircle2
                      size={40}
                      className="mx-auto mb-3 opacity-30"
                    />
                    <p>
                      {activeTab === "active"
                        ? dueFilter === "noDue"
                          ? "期限なしのタスクはありません"
                          : "タスクはすべて完了しました！🎉"
                        : "完了したタスクはありません"}
                    </p>
                  </div>
                ) : activeTab === "active" ? (
                  <div>
                    {activeGroups.map((group) => (
                      <section
                        key={group.bucket}
                        className="border-b last:border-b-0"
                        style={{ borderColor: "var(--ui-border)" }}
                      >
                        <div
                          className="sticky top-0 z-[5] px-4 py-2.5 backdrop-blur-md border-b flex items-baseline justify-between gap-2"
                          style={{
                            background: panelBg.replace(
                              /rgba\((.*), [0-9.]+\)/,
                              "rgba($1, 0.9)"
                            ),
                            borderColor: "var(--ui-border)",
                          }}
                        >
                          <h3 className="text-sm font-bold opacity-90">
                            {group.title}
                          </h3>
                          <span className="text-[11px] font-medium opacity-60 tabular-nums">
                            {group.tasks.length} 件
                          </span>
                        </div>
                        <div
                          className="divide-y"
                          style={{ borderColor: "var(--ui-border)" }}
                        >
                          {group.tasks.map((task) => {
                            const overdue =
                              task.status !== "completed" &&
                              isOverdue(task.due);
                            const isKbFocus = keyboardFocusedTaskId === task.id;
                            const isMultiSel =
                              showCheckboxes && selectedTasks.has(task.id);
                            return (
                              <div
                                key={task.id}
                                data-task-row-id={task.id}
                                onClick={() => {
                                  if (showCheckboxes) toggleSelection(task.id);
                                }}
                                className={`p-4 flex items-start gap-3 transition-all duration-300 group border-l-2 ${isKbFocus
                                    ? "ring-2 ring-inset ring-[var(--ui-accent)] z-[1]"
                                    : ""
                                  } ${isMultiSel
                                    ? "bg-[var(--ui-accent-light)] border-[var(--ui-accent)]"
                                    : overdue
                                      ? "bg-[var(--ui-danger-bg)] border-[var(--ui-danger)] hover:brightness-95"
                                      : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                                  } ${showCheckboxes ? "cursor-pointer" : ""}`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskStatus(task);
                                  }}
                                  className="mt-1 p-0.5 -ml-0.5 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                                >
                                  {task.status === "completed" ? (
                                    <CheckCircle2
                                      className="text-[var(--ui-success)] transition"
                                      size={22}
                                    />
                                  ) : (
                                    <Circle
                                      className={`${overdue
                                          ? "text-[var(--ui-danger)] opacity-70"
                                          : "text-[var(--ui-text-muted)] opacity-40 group-hover:text-[var(--ui-accent)] group-hover:opacity-100"
                                        } transition`}
                                      size={22}
                                    />
                                  )}
                                </button>
                                <div className="flex-grow min-w-0">
                                  <h3
                                    className={`font-medium text-base mb-1.5 whitespace-normal break-words ${overdue
                                        ? "text-[var(--ui-danger)]"
                                        : "text-[var(--ui-text)]"
                                      }`}
                                  >
                                    {task.cleanTitle}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {(task.platforms || []).map((p) => (
                                      <span
                                        key={p}
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getLmsBadgeClass(
                                          p
                                        )}`}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                    {task.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTag(tag);
                                        }}
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition ${getTagColor(
                                          tag
                                        )}`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {task.due && (
                                      <div
                                        className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${overdue
                                            ? "text-[var(--ui-danger)] bg-[var(--ui-danger-bg)] border-[var(--ui-danger)] border-opacity-30"
                                            : "text-[var(--ui-warning)] bg-[var(--ui-warning-bg)] border-[var(--ui-warning)] border-opacity-30"
                                          }`}
                                      >
                                        {overdue ? (
                                          <AlertCircle size={11} />
                                        ) : (
                                          <Calendar size={11} />
                                        )}
                                        {overdue ? "期限超過: " : "期限: "}
                                        {formatDue(task.due)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div>
                    {historyGroups.map((group, idx) => (
                      <section
                        key={`hist-${idx}`}
                        className="border-b last:border-b-0"
                        style={{ borderColor: "var(--ui-border)" }}
                      >
                        <div
                          className="sticky top-0 z-[5] px-4 py-2.5 backdrop-blur-md border-b flex items-baseline justify-between gap-2"
                          style={{
                            background: panelBg.replace(
                              /rgba\((.*), [0-9.]+\)/,
                              "rgba($1, 0.9)"
                            ),
                            borderColor: "var(--ui-border)",
                          }}
                        >
                          <h3 className="text-sm font-bold opacity-90">
                            {group.title}
                          </h3>
                          <span className="text-[11px] font-medium opacity-60 tabular-nums">
                            {group.tasks.length} 件
                          </span>
                        </div>
                        <div
                          className="divide-y"
                          style={{ borderColor: "var(--ui-border)" }}
                        >
                          {group.tasks.map((task) => {
                            const overdue =
                              task.status !== "completed" &&
                              isOverdue(task.due);
                            const isKbFocus = keyboardFocusedTaskId === task.id;
                            const isMultiSel =
                              showCheckboxes && selectedTasks.has(task.id);
                            return (
                              <div
                                key={task.id}
                                data-task-row-id={task.id}
                                onClick={() => {
                                  if (showCheckboxes) toggleSelection(task.id);
                                }}
                                className={`p-4 flex items-start gap-3 transition-all duration-300 group border-l-2 ${isKbFocus
                                    ? "ring-2 ring-inset ring-[var(--ui-accent)] z-[1]"
                                    : ""
                                  } ${isMultiSel
                                    ? "bg-[var(--ui-accent-light)] border-[var(--ui-accent)] opacity-100 grayscale-0"
                                    : "border-transparent opacity-50 grayscale hover:opacity-100 hover:grayscale-0 hover:bg-black/5 dark:hover:bg-white/5"
                                  } ${showCheckboxes ? "cursor-pointer" : ""}`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskStatus(task);
                                  }}
                                  className="mt-1 p-0.5 -ml-0.5 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                                >
                                  {task.status === "completed" ? (
                                    <CheckCircle2
                                      className="text-[var(--ui-success)] transition"
                                      size={22}
                                    />
                                  ) : (
                                    <Circle
                                      className={`${overdue
                                          ? "text-red-400 group-hover:text-red-500"
                                          : "text-slate-300 group-hover:text-blue-500"
                                        } transition`}
                                      size={22}
                                    />
                                  )}
                                </button>
                                <div className="flex-grow min-w-0">
                                  <h3
                                    className={`font-medium text-base mb-1.5 whitespace-normal break-words line-through text-[var(--ui-text-muted)]`}
                                  >
                                    {task.cleanTitle}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {(task.platforms || []).map((p) => (
                                      <span
                                        key={p}
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getLmsBadgeClass(
                                          p
                                        )}`}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                    {task.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTag(tag);
                                        }}
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition ${getTagColor(
                                          tag
                                        )}`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                    {task.completed && (
                                      <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--ui-text-muted)] bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full border border-[var(--ui-border)]">
                                        <History size={11} /> 完了:{" "}
                                        {formatDate(task.completed)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {(accessToken || isDemo) && activeTab === "active" && (
        <button
          type="button"
          title={taskFormExpanded ? "追加パネルを閉じる" : "タスクを追加"}
          onClick={() => setTaskFormExpanded((v) => !v)}
          className="ui-fab fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-[1.03] active:scale-95 focus:outline-none sm:bottom-6 sm:right-6 xl:bottom-8 xl:right-10"
          aria-expanded={taskFormExpanded}
        >
          {taskFormExpanded ? <X size={26} /> : <Plus size={26} />}
        </button>
      )}

      {periodModalPeriod &&
        (() => {
          const periodTitleMap = {
            weekBeforeLast: "先々週のタスク",
            lastWeek: "先週のタスク",
            week: "今週のタスク",
            nextWeek: "来週のタスク",
            weekAfterNext: "再来週のタスク",
            month: "今月のタスク",
            nextMonth: "来月のタスク",
            monthAfterNext: "再来月のタスク",
          };
          const sourceTasks =
            periodModalPeriod === "weekBeforeLast"
              ? weekBeforeLastStats.tasks
              : periodModalPeriod === "lastWeek"
                ? lastWeekStats.tasks
                : periodModalPeriod === "week"
                  ? weeklyStats.tasks
                  : periodModalPeriod === "nextWeek"
                    ? nextWeekStats.tasks
                    : periodModalPeriod === "weekAfterNext"
                      ? weekAfterNextStats.tasks
                      : periodModalPeriod === "month"
                        ? monthStats.tasks
                        : periodModalPeriod === "nextMonth"
                          ? nextMonthStats.tasks
                          : monthAfterNextStats.tasks;
          const modalTasks = sourceTasks
            .map((snapshot) => {
              const original = tasks.find((x) => x.id === snapshot.id) || {};
              return { ...original, ...snapshot };
            })
            .sort((a, b) => {
              const ta =
                a.due && !Number.isNaN(new Date(a.due).getTime())
                  ? new Date(a.due).getTime()
                  : Infinity;
              const tb =
                b.due && !Number.isNaN(new Date(b.due).getTime())
                  ? new Date(b.due).getTime()
                  : Infinity;
              return ta - tb;
            });

          const mTot = modalTasks.length;
          const mComp = modalTasks.filter(
            (t) => t.status === "completed"
          ).length;
          const mRate = mTot === 0 ? 0 : Math.round((mComp / mTot) * 100);

          const mTagData = {};
          modalTasks.forEach((t) => {
            const tagList = t.tags.length === 0 ? ["未分類"] : t.tags;
            tagList.forEach((tag) => {
              if (!mTagData[tag]) mTagData[tag] = { t: 0, c: 0 };
              mTagData[tag].t++;
              if (t.status === "completed") mTagData[tag].c++;
            });
          });

          const grouped = {};
          modalTasks.forEach((t) => {
            let dateLabel = t.due
              ? formatDue(t.due).split(" ")[0]
              : "期限なし";

            if (t.isRollover) {
              dateLabel = `⚠️ 遅延繰越 (元期限: ${dateLabel})`;
            } else if (t.isDelayedCompletion) {
              dateLabel = `⚠️ 遅延完了 (元期限: ${dateLabel})`;
            }

            if (!grouped[dateLabel]) grouped[dateLabel] = [];
            grouped[dateLabel].push(t);
          });
          const groupedEntries = Object.entries(grouped).sort(
            ([ka, aTasks], [kb, bTasks]) => {
              if (ka === "期限なし") return 1;
              if (kb === "期限なし") return -1;
              const minA = Math.min(
                ...aTasks.map((x) =>
                  x.due ? new Date(x.due).getTime() : Infinity
                )
              );
              const minB = Math.min(
                ...bTasks.map((x) =>
                  x.due ? new Date(x.due).getTime() : Infinity
                )
              );
              return minA - minB;
            }
          );

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in [perspective:1200px]"
              onClick={() => setPeriodModalPeriod(null)}
              role="presentation"
            >
              <div
                className={`bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 ${periodModalTiltDeg !== 0 ? "period-modal-3d-panel" : ""
                  }`}
                style={{ "--period-from-tilt": `${periodModalTiltDeg}deg` }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="period-modal-title"
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 shrink-0 gap-2">
                  <div className="min-w-0">
                    <h3
                      id="period-modal-title"
                      className="font-bold text-slate-800"
                    >
                      {periodTitleMap[periodModalPeriod]}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      ← → 期間切替 · Esc で閉じる
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPeriodModalPeriod(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition shrink-0"
                    aria-label="閉じる"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-100 bg-white shrink-0 space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>全体の進捗</span>
                      <span>
                        {mRate}% ({mComp}/{mTot})
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${mRate === 100 ? "bg-emerald-400" : "bg-blue-500"
                          }`}
                        style={{ width: `${mRate}%` }}
                      />
                    </div>
                  </div>
                  {Object.keys(mTagData).length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {Object.entries(mTagData).map(([tag, { t, c }]) => {
                        const r = t === 0 ? 0 : Math.round((c / t) * 100);
                        return (
                          <div key={tag} className="flex-1 min-w-[120px]">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span className="truncate pr-1">{tag}</span>
                              <span>{r}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${r === 100 ? "bg-emerald-400" : "bg-blue-400"
                                  }`}
                                style={{ width: `${r}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="overflow-y-auto p-4 space-y-5 bg-slate-50/50">
                  {modalTasks.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">
                      タスクがありません
                    </p>
                  ) : (
                    groupedEntries.map(([dateLabel, gTasks]) => {
                      const sorted = [...gTasks].sort(
                        (a, b) =>
                          (a.due ? new Date(a.due).getTime() : 0) -
                          (b.due ? new Date(b.due).getTime() : 0)
                      );
                      return (
                        <div key={dateLabel}>
                          <h4 className="text-xs font-bold text-slate-500 mb-2 border-b border-slate-200 pb-1">
                            {dateLabel}
                          </h4>
                          <div className="space-y-2">
                            {sorted.map((task) => {
                              const done = task.status === "completed";
                              const overdue =
                                !done && task.due && isOverdue(task.due);

                              return (
                                <div
                                  key={task.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg shadow-sm transition-all border ${done
                                      ? "opacity-50 grayscale border-transparent bg-transparent"
                                      : "bg-[var(--ui-panel-bg)] border-black/5 dark:border-white/5"
                                    }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleTaskStatus(task)}
                                    className="mt-0.5 shrink-0 focus:outline-none transition-transform active:scale-90"
                                  >
                                    {done ? (
                                      <CheckCircle2
                                        size={18}
                                        className="text-[var(--ui-success)]"
                                      />
                                    ) : (
                                      <Circle
                                        size={18}
                                        className={
                                          overdue
                                            ? "text-[var(--ui-danger)]"
                                            : "text-[var(--ui-text-muted)] opacity-40"
                                        }
                                      />
                                    )}
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-sm font-medium whitespace-normal break-words leading-tight ${done
                                          ? "line-through text-[var(--ui-text-muted)]"
                                          : overdue
                                            ? "text-[var(--ui-danger)]"
                                            : "text-[var(--ui-text)]"
                                        }`}
                                    >
                                      {task.cleanTitle}
                                    </p>
                                    {(task.platforms?.length > 0 ||
                                      task.tags?.length > 0) && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {(task.platforms || []).map((p) => (
                                            <span
                                              key={p}
                                              className={`text-[9px] px-1.5 py-px rounded border ${getLmsBadgeClass(
                                                p
                                              )}`}
                                            >
                                              {p}
                                            </span>
                                          ))}
                                          {(task.tags || []).map((tag) => (
                                            <span
                                              key={tag}
                                              className={`text-[9px] px-1.5 py-px rounded border ${getTagColor(
                                                tag
                                              )}`}
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function CalendarView({
  tasks,
  mode,
  setMode,
  cursor,
  setCursor,
  toggleTaskStatus,
  getTagColor,
}) {
  const [dateBase, setDateBase] = useState("due");
  const [selectedMobileDate, setSelectedMobileDate] = useState(
    () => new Date()
  );
  const now = new Date();
  const { start: weekStart } = getWeekRange(cursor);

  const goPrev = () => {
    const d = new Date(cursor);
    if (mode === "month") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCursor(d);
  };
  const goNext = () => {
    const d = new Date(cursor);
    if (mode === "month") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCursor(d);
  };

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const firstDow = firstOfMonth.getDay();
  const mondayOffset = (firstDow + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - mondayOffset);

  const groupedTasks = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const targetDateStr = dateBase === "completed" ? t.completed : t.due;
      if (!targetDateStr) return;
      if (dateBase === "completed" && t.status !== "completed") return;

      const parts = dueCalendarDayParts(targetDateStr);
      if (!parts) return;
      const key = `${parts.y}-${parts.mo}-${parts.d}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return map;
  }, [tasks, dateBase]);

  const tasksForDay = (dayDate) => {
    const key = `${dayDate.getFullYear()}-${dayDate.getMonth()}-${dayDate.getDate()}`;
    return groupedTasks.get(key) || [];
  };

  const renderTaskRow = (task, isMobile = false) => {
    const done = task.status === "completed";
    const overdue = !done && task.due && isOverdue(task.due);
    return (
      <div
        key={task.id}
        className={`flex items-start ${isMobile ? "gap-3 py-3" : "gap-1.5 py-1.5"
          } text-left border-b border-black/5 dark:border-white/5 last:border-0 transition-opacity ${done ? "opacity-50 grayscale" : ""
          }`}
      >
        <button
          type="button"
          onClick={() => toggleTaskStatus(task)}
          className="mt-0.5 shrink-0 focus:outline-none"
        >
          {done ? (
            <CheckCircle2
              size={isMobile ? 20 : 14}
              className="text-[var(--ui-success)]"
            />
          ) : (
            <Circle
              size={isMobile ? 20 : 14}
              className={
                overdue
                  ? "text-[var(--ui-danger)]"
                  : "text-[var(--ui-text-muted)] opacity-40"
              }
            />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={`${isMobile ? "text-sm" : "text-[10px] sm:text-[11px]"
              } leading-snug break-words whitespace-normal hyphens-auto ${done
                ? "line-through text-[var(--ui-text-muted)]"
                : overdue
                  ? "text-[var(--ui-danger)] font-medium"
                  : "text-[var(--ui-text)]"
              }`}
          >
            {task.cleanTitle}
          </p>
          {(task.platforms?.length > 0 || task.tags?.length > 0) && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {(task.platforms || []).map((p) => (
                <span
                  key={p}
                  className={`text-[8px] px-1 py-px rounded border leading-tight ${getLmsBadgeClass(
                    p
                  )}`}
                >
                  {p}
                </span>
              ))}
              {(task.tags || []).map((tag) => (
                <span
                  key={tag}
                  className={`text-[8px] px-1 py-px rounded border leading-tight ${getTagColor(
                    tag
                  )}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border p-4 space-y-4"
      style={{
        background: "var(--ui-panel-bg)",
        borderColor: "var(--ui-border)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border overflow-hidden shadow-sm"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <button
              type="button"
              onClick={() => setMode("month")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${mode === "month"
                  ? "bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)]"
                  : "bg-transparent text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              月
            </button>
            <button
              type="button"
              onClick={() => setMode("week")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${mode === "week"
                  ? "bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)]"
                  : "bg-transparent text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              週
            </button>
          </div>
          <div
            className="flex rounded-lg border overflow-hidden shadow-sm ml-2"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <button
              type="button"
              onClick={() => setDateBase("due")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${dateBase === "due"
                  ? "bg-[var(--ui-text)] text-[var(--ui-panel-bg)]"
                  : "bg-transparent text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              設定日
            </button>
            <button
              type="button"
              onClick={() => setDateBase("completed")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${dateBase === "completed"
                  ? "bg-[var(--ui-text)] text-[var(--ui-panel-bg)]"
                  : "bg-transparent text-[var(--ui-text-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              完了日
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="p-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="text-sm font-semibold min-w-[160px] text-center"
            style={{ color: "var(--ui-text)" }}
          >
            {mode === "month"
              ? `${y}年 ${m + 1}月`
              : formatWeekLabel(weekStart)}
          </span>
          <button
            type="button"
            onClick={goNext}
            className="p-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition"
            style={{ borderColor: "var(--ui-border)" }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {mode === "month" ? (
        <div className="flex flex-col sm:block">
          <div
            className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border"
            style={{
              backgroundColor: "var(--ui-border)",
              borderColor: "var(--ui-border)",
            }}
          >
            {CAL_WEEK_LABELS.map((lab) => (
              <div
                key={lab}
                className="text-center text-[10px] font-semibold py-2 opacity-70"
                style={{ background: "var(--ui-panel-bg)" }}
              >
                {lab}
              </div>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const cellDate = new Date(gridStart);
              cellDate.setDate(gridStart.getDate() + i);
              const inMonth = cellDate.getMonth() === m;
              const isTodayCell = sameLocalDay(cellDate, now);
              const isSelectedCell = sameLocalDay(cellDate, selectedMobileDate);
              const dayTasks = tasksForDay(cellDate);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedMobileDate(cellDate)}
                  className={`min-h-[80px] sm:min-h-[120px] p-1 sm:p-1.5 cursor-pointer sm:cursor-default transition-colors relative ${!inMonth ? "opacity-45" : ""
                    } ${isTodayCell
                      ? "ring-2 ring-inset ring-[var(--ui-accent)]"
                      : ""
                    } ${isSelectedCell
                      ? "bg-[var(--ui-accent-light)] sm:bg-[var(--ui-panel-bg)]"
                      : ""
                    }`}
                  style={{ background: "var(--ui-panel-bg)" }}
                >
                  <div
                    className={`text-[10px] sm:text-[11px] font-semibold mb-1 text-center sm:text-left ${isTodayCell ? "text-[var(--ui-accent)]" : ""
                      }`}
                  >
                    {cellDate.getDate()}
                  </div>

                  {/* PC: Task Text */}
                  <div className="hidden sm:block max-h-[160px] overflow-y-auto pr-0.5">
                    {dayTasks.map((t) => renderTaskRow(t, false))}
                  </div>

                  {/* Mobile: Task name preview (Improved Visibility) */}
                  <div className="sm:hidden mt-0.5 flex flex-col gap-0.5 overflow-hidden px-0.5">
                    {dayTasks.slice(0, 3).map((t) => {
                      const done = t.status === "completed";
                      const overdue = !done && t.due && isOverdue(t.due);

                      // タグや状態に応じた背景色の適用
                      let bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
                      if (overdue) {
                        bgClass = "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)] border border-[var(--ui-danger)] border-opacity-30";
                      } else if (done) {
                        bgClass = "bg-transparent text-[var(--ui-text-muted)] line-through opacity-60";
                      } else if (t.tags && t.tags.length > 0) {
                        bgClass = getTagColor(t.tags[0]);
                      }

                      return (
                        <div
                          key={t.id}
                          className={`text-[8px] leading-[1.2] truncate px-1 py-0.5 rounded-sm font-medium ${bgClass}`}
                        >
                          {t.cleanTitle}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[9px] font-bold text-[var(--ui-text-muted)] text-center mt-0.5">
                        +{dayTasks.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: Selected Date Detail */}
          <div
            className="sm:hidden mt-4 p-4 rounded-xl border-2"
            style={{
              borderColor: "var(--ui-accent)",
              background: "var(--ui-accent-light)",
            }}
          >
            <h4
              className="text-sm font-bold mb-3 border-b pb-2 flex items-center gap-2"
              style={{
                borderColor: "var(--ui-accent)",
                color: "var(--ui-accent-dark)",
              }}
            >
              <Calendar size={16} className="opacity-70" />
              {selectedMobileDate.getMonth() + 1}月
              {selectedMobileDate.getDate()}日 (
              {WEEKDAYS[selectedMobileDate.getDay()]}) のタスク
            </h4>
            <div className="space-y-1">
              {tasksForDay(selectedMobileDate).length === 0 ? (
                <p className="text-xs opacity-50 text-center py-4">
                  タスクなし
                </p>
              ) : (
                tasksForDay(selectedMobileDate).map((t) =>
                  renderTaskRow(t, true)
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 sm:gap-2">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const isTodayCell = sameLocalDay(d, now);
            const dayTasks = tasksForDay(d);
            return (
              <div
                key={i}
                className={`border rounded-xl p-3 sm:p-2 min-h-[120px] sm:min-h-[260px] flex flex-col ${isTodayCell
                    ? "border-[var(--ui-accent)] bg-[var(--ui-accent-light)]"
                    : "border-[var(--ui-border)] bg-black/5 dark:bg-white/5"
                  }`}
              >
                <div
                  className={`text-xs sm:text-xs font-bold mb-2 pb-2 border-b shrink-0 flex justify-between sm:block ${isTodayCell
                      ? "text-[var(--ui-accent)] border-[var(--ui-accent)]/30"
                      : "text-[var(--ui-text)] border-[var(--ui-border)]"
                    }`}
                >
                  <span>
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                  <span className="font-normal opacity-60">
                    ({WEEKDAYS[d.getDay()]})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                  {dayTasks.length === 0 ? (
                    <p className="text-[10px] opacity-40">タスクなし</p>
                  ) : (
                    dayTasks.map((t) => renderTaskRow(t, false))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeriodCard({ label, icon, stats = {}, accent, onClick }) {
  const { completed = 0, totalTarget = 0, rate = 0 } = stats;
  const isEmpty = totalTarget === 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="bg-white ui-panel rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between items-start cursor-pointer hover:border-[var(--ui-accent)] hover:shadow-md transition-all h-full"
    >
      <div className="w-full">
        <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
          {icon}
          {label}
        </p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className={`text-2xl font-bold ${accent}`}>{completed}</span>
          <span className="text-slate-400 text-lg font-semibold">/</span>
          <span className="text-lg font-semibold text-slate-600">
            {totalTarget}
          </span>
        </div>
      </div>
      <div className="mt-4 w-full">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${isEmpty
                ? "bg-slate-200"
                : rate === 100
                  ? "bg-emerald-400"
                  : "bg-[var(--ui-accent)]"
              }`}
            style={{ width: `${isEmpty ? 0 : rate}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          {isEmpty ? "対象タスクなし" : `達成率 ${rate}%`}
        </p>
      </div>
    </div>
  );
}

function RoutineDetectorView({
  routineGroups,
  selectedRoutine,
  toggleTaskStatus,
  selectedTasks,
  toggleSelection,
  setSelectedTasks,
  handleDeleteSelected,
  showCheckboxes,
  selectionMode,
  setSelectionMode,
  showCompleted,
  setShowCompleted,
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectionMode((prev) => {
                if (prev) setSelectedTasks(new Set());
                return !prev;
              });
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition border shrink-0 ${selectionMode
                ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
          >
            {selectionMode ? "選択終了" : "選択モード"}
          </button>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Shiftキー長押しでも複数選択可
          </span>
        </div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600 cursor-pointer hover:text-slate-800">
          <input
            type="checkbox"
            checked={!showCompleted}
            onChange={(e) => setShowCompleted(!e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
          />
          達成済を隠す
        </label>
      </div>

      {/* 洗練されたフローティング選択削除バー (Organize画面用) */}
      {selectedTasks.size > 0 && (
        <div
          className="fixed bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-8 fade-in flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl border"
          style={{
            background: "var(--ui-panel-bg)",
            borderColor: "var(--ui-border)",
            backdropFilter: "blur(24px)",
          }}
        >
          <span
            className="text-xs sm:text-sm font-bold flex items-center gap-2"
            style={{ color: "var(--ui-text)" }}
          >
            <span className="bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)] w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs shadow-sm">
              {selectedTasks.size}
            </span>
            件選択中
          </span>
          <div className="w-px h-6 bg-black/10 dark:bg-white/10" />
          <button
            type="button"
            onClick={() => setSelectedTasks(new Set())}
            className="text-xs sm:text-sm font-bold opacity-50 hover:opacity-100 transition px-1"
            style={{ color: "var(--ui-text)" }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
          >
            <Trash2 size={16} /> 削除する
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 items-start">
        {routineGroups.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
            <Layers size={40} className="mx-auto mb-3 opacity-20" />
            <p>該当するタスクはありません</p>
          </div>
        ) : (
          routineGroups.map((group, idx) => {
            const sortedTasks = [...group.tasks]
              .filter((t) => showCompleted || t.status !== "completed")
              .sort((a, b) => {
                const da = a.due ? new Date(a.due).getTime() : Infinity;
                const db = b.due ? new Date(b.due).getTime() : Infinity;
                return da - db;
              });

            if (sortedTasks.length === 0) return null;

            const isHighlighted =
              selectedRoutine === (group.titleLabel || group.title);

            return (
              <div
                key={group.titleLabel || group.title + String(idx)}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col transition-all duration-300 ${isHighlighted
                    ? "ring-2 ring-amber-400 border-amber-200 scale-[1.01]"
                    : "border-slate-100"
                  }`}
              >
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <h3
                      className="font-bold text-slate-800 text-base truncate flex-1 pr-4"
                      title={group.titleLabel || group.title}
                    >
                      {group.titleLabel || group.title}
                    </h3>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                      {group.count} 件
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(group.completedCount / (group.count || 1)) * 100
                            }%`,
                        }}
                      />
                    </div>
                    <span>
                      {Math.round(
                        (group.completedCount / (group.count || 1)) * 100
                      )}
                      % ({group.completedCount}/{group.count})
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-white flex justify-between items-center border-b border-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      const ids = group.tasks.map((t) => t.id);
                      setSelectedTasks((prev) => {
                        const next = new Set(prev);
                        const allSelected = ids.every((id) => next.has(id));
                        ids.forEach((id) =>
                          allSelected ? next.delete(id) : next.add(id)
                        );
                        return next;
                      });
                    }}
                    className="text-xs flex items-center gap-1 px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                  >
                    {group.tasks.every((t) => selectedTasks.has(t.id)) ? (
                      <CheckSquare size={14} className="text-blue-600" />
                    ) : (
                      <Circle size={14} />
                    )}
                    {group.tasks.every((t) => selectedTasks.has(t.id))
                      ? "グループ解除"
                      : "グループ選択"}
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50 p-2">
                  {sortedTasks.map((task) => {
                    const done = task.status === "completed";
                    const isSelected = selectedTasks.has(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (showCheckboxes) toggleSelection(task.id);
                        }}
                        className={`flex items-start gap-3 p-2 rounded-lg transition-all duration-300 group ${showCheckboxes ? "cursor-pointer" : ""
                          } ${isSelected
                            ? "bg-[var(--ui-accent-light)] ring-1 ring-[var(--ui-accent)]"
                            : "hover:bg-black/5 dark:hover:bg-white/5"
                          } ${done ? "opacity-60 grayscale hover:grayscale-0" : ""
                          }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task);
                          }}
                          className="mt-0.5 shrink-0 focus:outline-none transition-transform active:scale-90"
                        >
                          {done ? (
                            <CheckCircle2
                              size={16}
                              className="text-[var(--ui-success)]"
                            />
                          ) : (
                            <Circle
                              size={16}
                              className="text-[var(--ui-text-muted)] opacity-40 group-hover:text-[var(--ui-accent)] group-hover:opacity-100 transition"
                            />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${done
                                ? "line-through text-[var(--ui-text-muted)]"
                                : "text-[var(--ui-text)]"
                              }`}
                          >
                            {task.cleanTitle}
                          </p>
                          {task.due && (
                            <p className="text-[10px] text-[var(--ui-text-muted)] mt-0.5 opacity-80">
                              {new Date(task.due).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TagManagerView({
  tagStats,
  tasks,
  toggleTaskStatus,
  getTagColor,
  selectedTasks,
  toggleSelection,
  setSelectedTasks,
  handleDeleteSelected,
  showCheckboxes,
  selectionMode,
  setSelectionMode,
  showCompleted,
  setShowCompleted,
}) {
  const tagGroups = useMemo(() => {
    return tagStats
      .filter((s) => s.tag !== "未分類")
      .map((s) => {
        const gTasks = tasks.filter((t) => t.tags.includes(s.tag));
        const completedCount = gTasks.filter(
          (t) => t.status === "completed"
        ).length;
        return {
          title: s.tag,
          titleLabel: s.tag,
          activeCount: gTasks.length - completedCount,
          count: gTasks.length,
          completedCount,
          tasks: gTasks,
        };
      })
      .sort((a, b) => b.activeCount - a.activeCount || b.count - a.count);
  }, [tagStats, tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="text-rose-500" size={24} />
        <h2 className="text-xl font-bold text-slate-800">タグ管理</h2>
        <span className="text-xs text-slate-400 ml-2">
          タグごとのタスク状況を一括管理
        </span>
      </div>
      <RoutineDetectorView
        routineGroups={tagGroups}
        toggleTaskStatus={toggleTaskStatus}
        selectedTasks={selectedTasks}
        toggleSelection={toggleSelection}
        setSelectedTasks={setSelectedTasks}
        handleDeleteSelected={handleDeleteSelected}
        showCheckboxes={showCheckboxes}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
      />
    </div>
  );
}

function CompositeChart({ series, labelFor }) {
  // 配列が空の場合の Math.max(-Infinity) エラーを防止
  const safeSeriesTotals =
    series && series.length > 0 ? series.map((w) => w.total || 0) : [0];
  const maxTotal = Math.max(1, ...safeSeriesTotals);
  const W = 700,
    H = 260,
    PAD = { t: 24, b: 32, l: 40, r: 40 };
  const barAreaH = H - PAD.t - PAD.b;

  const segment = (W - PAD.l - PAD.r) / (series && series.length > 0 ? series.length : 1);
  const barW = Math.min(32, segment - 8);
  const xOfBar = (i) => PAD.l + i * segment + segment / 2;
  const yOfRate = (rate) => PAD.t + barAreaH * (1 - rate / 100);
  const yOfBar = (val) => PAD.t + barAreaH * (1 - val / maxTotal);
  const barH = (val) => barAreaH * (val / maxTotal);

  const points = series
    .map((w, i) => `${xOfBar(i)},${yOfRate(w.rate)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto hide-scrollbar pb-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[600px] drop-shadow-sm"
        style={{ fontFamily: "var(--ui-font)" }}
      >
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ui-accent)" />
            <stop offset="100%" stopColor="var(--ui-accent-dark)" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={`grid-${t}`}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={PAD.t + barAreaH * t}
              y2={PAD.t + barAreaH * t}
              stroke="#f1f5f9"
              strokeWidth="1"
            />
            <text
              x={PAD.l - 8}
              y={PAD.t + barAreaH * t + 3}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {Math.round(maxTotal * (1 - t))}
            </text>
            <text
              x={W - PAD.r + 8}
              y={PAD.t + barAreaH * t + 3}
              textAnchor="start"
              fontSize="10"
              fill="#94a3b8"
            >
              {Math.round((1 - t) * 100)}%
            </text>
          </g>
        ))}

        {series.map((w, i) => (
          <rect
            key={`tot-${i}`}
            x={xOfBar(i) - barW / 2}
            y={yOfBar(w.total)}
            width={barW}
            height={barH(w.total)}
            fill="var(--ui-accent-light)"
            rx="4"
            opacity="0.6"
          />
        ))}

        {series.map((w, i) => (
          <rect
            key={`comp-${i}`}
            x={xOfBar(i) - barW / 2}
            y={yOfBar(w.completed)}
            width={barW}
            height={barH(w.completed)}
            fill="url(#barGrad)"
            rx="4"
            className={w.isFuture ? "opacity-40" : "opacity-95"}
          />
        ))}

        <polyline
          points={points}
          fill="none"
          stroke="var(--ui-accent-dark)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {series.map((w, i) => (
          <g key={`point-${i}`}>
            <circle
              cx={xOfBar(i)}
              cy={yOfRate(w.rate)}
              r="4"
              fill="#ffffff"
              stroke="var(--ui-accent-dark)"
              strokeWidth="2"
            />
            {w.total > 0 && (
              <text
                x={xOfBar(i)}
                y={yOfRate(w.rate) - 10}
                textAnchor="middle"
                fontSize="11"
                fill="var(--ui-accent-dark)"
                fontWeight="800"
              >
                {w.rate}%
              </text>
            )}
            <text
              x={xOfBar(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill={w.isCurrent ? "var(--ui-accent-dark)" : "#64748b"}
              fontWeight={w.isCurrent ? "800" : "500"}
            >
              {labelFor(w)}
            </text>
          </g>
        ))}

        <g transform={`translate(${PAD.l}, 8)`}>
          <rect width="10" height="10" fill="var(--ui-accent-light)" rx="2" />
          <text x="14" y="9" fontSize="10" fill="#64748b">
            設定数
          </text>
          <rect x="65" width="10" height="10" fill="url(#barGrad)" rx="2" />
          <text x="79" y="9" fontSize="10" fill="#64748b">
            完了数 (左軸)
          </text>
          <line
            x1="150"
            y1="5"
            x2="165"
            y2="5"
            stroke="var(--ui-accent-dark)"
            strokeWidth="2"
          />
          <circle
            cx="157.5"
            cy="5"
            r="3"
            fill="#fff"
            stroke="var(--ui-accent-dark)"
            strokeWidth="1.5"
          />
          <text x="170" y="9" fontSize="10" fill="#64748b">
            達成率 (右軸)
          </text>
        </g>
      </svg>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div
    className="bg-white rounded-xl shadow-sm border p-5 space-y-4"
    style={{
      background: "var(--ui-panel-bg)",
      borderColor: "var(--ui-border)",
    }}
  >
    <h3
      className="font-bold text-sm uppercase tracking-wider"
      style={{ color: "var(--ui-text)" }}
    >
      {title}
    </h3>
    {children}
  </div>
);

const OptionRow = ({ label, options, current, onChange }) => (
  <div className="flex flex-col lg:flex-row lg:items-center gap-3 border-b border-black/5 dark:border-white/5 pb-4 last:border-0 last:pb-0">
    <span className="text-sm font-bold w-40 shrink-0 opacity-90">{label}</span>
    <div
      className="flex-1 p-1.5 rounded-xl border"
      style={{ background: "var(--ui-bg)", borderColor: "var(--ui-border)" }}
    >
      <AnimatedToggle
        options={options}
        current={current}
        onChange={onChange}
        className="w-full"
        optionClassName="flex-1 min-w-[80px]"
      />
    </div>
  </div>
);

function UISettingsView({
  uiConfig,
  setUiConfig,
  tasks,
  accessToken,
  fetchRealTasks,
  isDemo,
  handleLogout,
  handleAuth,
}) {
  const [settingTab, setSettingTab] = useState("ui"); // 'ui' | 'replace'
  const update = (key, val) => setUiConfig((prev) => ({ ...prev, [key]: val }));
  const applyPreset = (config) => setUiConfig(config);

  // タスク置換用のState
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [replacing, setReplacing] = useState(false);
  const matchedTasks = tasks.filter(
    (t) =>
      searchText && t.title.includes(searchText) && t.status !== "completed"
  );

  const handleReplace = async () => {
    if (!accessToken && !isDemo) {
      alert("セッションが切れています。再接続してください。");
      handleAuth();
      return;
    }
    if (!searchText) return;
    const targetTasks = matchedTasks.slice(0, 10);
    if (targetTasks.length === 0) return;
    if (!window.confirm(`${targetTasks.length}件のタスク名を置換しますか？`))
      return;

    setReplacing(true);
    if (!isDemo) {
      try {
        await Promise.all(
          targetTasks.map((task) => {
            const newTitle = task.title.replace(
              new RegExp(searchText, "g"),
              replaceText
            );
            return fetch(
              `https://tasks.googleapis.com/tasks/v1/lists/${task.listId || "@default"}/tasks/${task.id}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ title: newTitle }),
              }
            );
          })
        );
        fetchRealTasks(accessToken);
        alert(`${targetTasks.length}件の置換が完了しました。`);
      } catch (e) {
        alert("一部の置換に失敗しました。");
      }
    } else {
      alert("デモモードではAPIは呼び出されません");
    }
    setReplacing(false);
  };

  const categories = [...new Set(THEME_PRESETS.map((p) => p.category))];

  return (
    <div className="space-y-6 w-full">
      <div
        className="flex items-center gap-2 mb-2 px-2 border-b pb-4"
        style={{ borderColor: "var(--ui-border)" }}
      >
        <Settings className="opacity-80" size={28} />
        <h2 className="text-2xl font-bold">システム設定</h2>
        <div className="ml-auto flex bg-black/5 dark:bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => setSettingTab("ui")}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${settingTab === "ui"
                ? "bg-[var(--ui-panel-bg)] shadow-sm"
                : "opacity-60"
              }`}
          >
            デザイン
          </button>
          <button
            onClick={() => setSettingTab("replace")}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${settingTab === "replace"
                ? "bg-[var(--ui-panel-bg)] shadow-sm"
                : "opacity-60"
              }`}
          >
            一括置換
          </button>
        </div>
      </div>

      {settingTab === "ui" ? (
        <div className="space-y-6 animate-in fade-in">
          <Section title="🎨 デザインプリセット (カテゴリ別)">
            <div className="space-y-8">
              {categories.map((cat) => (
                <div key={cat}>
                  <h4
                    className="text-xs font-bold opacity-60 mb-3 border-b pb-1"
                    style={{ borderColor: "var(--ui-border)" }}
                  >
                    {cat}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 items-stretch">
                    {THEME_PRESETS.filter((p) => p.category === cat).map(
                      (preset) => {
                        const bgThemeColorMap = {
                          white: "#ffffff",
                          light: "#f8fafc",
                          paper: "#fdfcf8",
                          gray: "#e5e7eb",
                          dark: "#1e293b",
                          navy: "#0a0a2a",
                          pitchBlack: "#000000",
                          cream: "#fefce8",
                          sepia: "#f3e8d2",
                        };
                        const accentColorMap = {
                          blue: "#2563eb",
                          indigo: "#4f46e5",
                          emerald: "#059669",
                          teal: "#0d9488",
                          cyan: "#0891b2",
                          rose: "#e11d48",
                          fuchsia: "#c026d3",
                          amber: "#d97706",
                          violet: "#7c3aed",
                          slate: "#64748b",
                          zinc: "#52525b",
                          white: "#f8fafc",
                          black: "#09090b",
                          gold: "#d4af37",
                          bronze: "#cd7f32",
                          sand: "#e7e5e4",
                        };
                        const previewBg =
                          bgThemeColorMap[preset.config.bgTheme] ?? "#f8fafc";
                        const previewAccent =
                          accentColorMap[preset.config.accent] ?? "#2563eb";
                        const isDarkP = ["dark", "navy", "pitchBlack"].includes(
                          preset.config.bgTheme
                        );
                        const previewText = isDarkP ? "#e2e8f0" : "#1e293b";
                        const previewRadiusPx =
                          {
                            none: "0px",
                            sm: "4px",
                            md: "8px",
                            lg: "14px",
                            xl: "20px",
                          }[preset.config.radius] ?? "8px";
                        const isActive =
                          preset.config.bgTheme === uiConfig.bgTheme &&
                          preset.config.accent === uiConfig.accent &&
                          preset.config.texture === uiConfig.texture &&
                          preset.config.radius === uiConfig.radius;

                        const previewFontMap = {
                          sans: '"Noto Sans JP", sans-serif',
                          mono: '"JetBrains Mono", monospace',
                          serif: '"Noto Serif JP", serif',
                          rounded: '"M PLUS Rounded 1c", sans-serif',
                          shippori: '"Shippori Mincho B1", serif',
                          zenOld: '"Zen Old Mincho", serif',
                          zenKakuNew: '"Zen Kaku Gothic New", sans-serif',
                          zenKakuAntique: '"Zen Kaku Gothic Antique", sans-serif',
                          bizUD: '"BIZ UDPGothic", sans-serif',
                          lineSeed: '"LINE Seed JP", sans-serif',
                        };
                        const previewFont = previewFontMap[preset.config.font] || previewFontMap.sans;

                        return (
                          <button
                            key={preset.id}
                            onClick={() => applyPreset(preset.config)}
                            className={`group relative flex flex-col items-start text-left h-full overflow-hidden transition-all duration-500 hover:-translate-y-1 ${isActive
                                ? "scale-[1.04] z-10"
                                : "hover:scale-[1.02]"
                              }`}
                            style={{
                              borderRadius: previewRadiusPx,
                              boxShadow: isActive
                                ? `0 10px 40px -8px ${previewAccent}80, 0 0 0 2px ${previewAccent}`
                                : "0 4px 20px -5px rgba(0,0,0,0.12)",
                              border: `1px solid ${isDarkP ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                              background: previewBg,
                              color: previewText,
                              fontFamily: previewFont,
                            }}
                          >
                            {/* ── Mini preview ── */}
                            <div
                              className="w-full relative overflow-hidden shrink-0 border-b"
                              style={{
                                height: 72,
                                background: previewBg,
                                borderColor: isDarkP ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                borderRadius: `${previewRadiusPx} ${previewRadiusPx} 0 0`,
                              }}
                            >
                              {/* Mock task rows */}
                              <div className="absolute inset-0 flex flex-col justify-center gap-1.5 px-3 py-2">
                                {[90, 75, 55].map((w, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1.5"
                                  >
                                    <div
                                      style={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: "50%",
                                        border: `2px solid ${i === 0
                                            ? previewAccent
                                            : previewText + "40"
                                          }`,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <div
                                      style={{
                                        width: `${w}%`,
                                        height: 5,
                                        borderRadius: 3,
                                        background:
                                          i === 0
                                            ? previewAccent + "50"
                                            : previewText + "18",
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                              {/* Accent FAB dot */}
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 6,
                                  right: 8,
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: previewAccent,
                                  boxShadow: `0 2px 8px ${previewAccent}70`,
                                }}
                              />
                              {/* Gradient overlay for neon/glass */}
                              {(preset.config.texture === "glass" ||
                                preset.config.useGradient) && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      background: `linear-gradient(135deg, ${previewAccent}18 0%, transparent 60%)`,
                                      pointerEvents: "none",
                                    }}
                                  />
                                )}
                            </div>

                            {/* ── Info ── */}
                            <div className="p-3 flex flex-col gap-2 w-full">
                              <span
                                className="font-bold text-sm leading-tight"
                                style={{ color: previewText }}
                              >
                                {preset.name}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                  style={{
                                    background: previewAccent + "22",
                                    color: previewAccent,
                                  }}
                                >
                                  {preset.config.accent}
                                </span>
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ background: isDarkP ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: previewText }}
                                >
                                  r:{preset.config.radius}
                                </span>
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ background: isDarkP ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: previewText }}
                                >
                                  {preset.config.texture}
                                </span>
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ background: isDarkP ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)", color: previewText }}
                                >
                                  {preset.config.animation}
                                </span>
                                {preset.config.useGradient && (
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                    style={{
                                      background: previewAccent + "30",
                                      color: previewAccent,
                                    }}
                                  >
                                    grad
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="⌨️ キーボードショートカット設定">
            <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 text-sm space-y-2 text-[var(--ui-text-muted)]">
              <p>タスクの操作を素早く行うためのショートカット一覧です。</p>
              <ul className="list-disc list-inside ml-4 space-y-1 font-medium">
                <li>
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    ↑
                  </kbd>{" "}
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    ↓
                  </kbd>{" "}
                  : タスクリストのフォーカス移動
                </li>
                <li>
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    Enter
                  </kbd>{" "}
                  : フォーカス中のタスクの完了/未完了の切り替え
                </li>
                <li>
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    1
                  </kbd>{" "}
                  〜{" "}
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    9
                  </kbd>{" "}
                  : アクティブなタグによる即座のフィルタリング
                </li>
                <li>
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    Esc
                  </kbd>{" "}
                  : タグフィルタの解除・フォーカス解除・モーダルの非表示
                </li>
                <li>
                  <kbd className="bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border text-[11px]">
                    Shift
                  </kbd>{" "}
                  (長押し) : タスクの複数選択モード一時切り替え
                </li>
              </ul>
              <p className="text-xs opacity-70 mt-2">
                ※ 文字入力フォームにフォーカスがある時はショートカットは無効になります。
              </p>
            </div>
          </Section>

          <Section title="🛠️ カスタム詳細設定">
            <OptionRow
              label="言語 (Language)"
              current={uiConfig.language}
              onChange={(v) => update("language", v)}
              options={[
                { value: "ja", label: "日本語" },
                { value: "en_mix", label: "Eng Mix" },
                { value: "en", label: "English" },
              ]}
            />
            <OptionRow
              label="ベーステーマ"
              current={uiConfig.bgTheme}
              onChange={(v) => update("bgTheme", v)}
              options={[
                { value: "white", label: "White" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "navy", label: "Navy" },
                { value: "pitchBlack", label: "Black" },
                { value: "paper", label: "Paper" },
                { value: "cream", label: "Cream" },
                { value: "sepia", label: "Sepia" },
                { value: "gray", label: "Gray" },
              ]}
            />
            <OptionRow
              label="アクセント"
              current={uiConfig.accent}
              onChange={(v) => update("accent", v)}
              options={[
                { value: "blue", label: "Blue" },
                { value: "indigo", label: "Indigo" },
                { value: "emerald", label: "Emerald" },
                { value: "rose", label: "Rose" },
                { value: "amber", label: "Amber" },
                { value: "violet", label: "Violet" },
                { value: "cyan", label: "Cyan" },
                { value: "slate", label: "Slate" },
                { value: "zinc", label: "Zinc" },
                { value: "gold", label: "Gold" },
              ]}
            />
            <OptionRow
              label="フォント"
              current={uiConfig.font}
              onChange={(v) => update("font", v)}
              options={[
                { value: "sans", label: "Sans" },
                { value: "serif", label: "Serif" },
                { value: "mono", label: "Mono" },
                { value: "rounded", label: "Rounded" },
                { value: "bizUD", label: "UD" },
                { value: "zenKakuAntique", label: "Antique" },
              ]}
            />
            <OptionRow
              label="フォントの太さ"
              current={uiConfig.weight}
              onChange={(v) => update("weight", v)}
              options={[
                { value: "light", label: "Light" },
                { value: "normal", label: "Normal" },
                { value: "medium", label: "Medium" },
                { value: "bold", label: "Bold" },
                { value: "black", label: "Black" },
              ]}
            />
            <OptionRow
              label="UIの余白 (Density)"
              current={uiConfig.density}
              onChange={(v) => update("density", v)}
              options={[
                { value: "compact", label: "狭い" },
                { value: "normal", label: "普通" },
                { value: "loose", label: "広い" },
              ]}
            />
            <OptionRow
              label="角丸"
              current={uiConfig.radius}
              onChange={(v) => update("radius", v)}
              options={[
                { value: "none", label: "なし" },
                { value: "sm", label: "小" },
                { value: "md", label: "中" },
                { value: "lg", label: "大" },
                { value: "xl", label: "特大" },
              ]}
            />
            <OptionRow
              label="影 (Shadow)"
              current={uiConfig.shadow}
              onChange={(v) => update("shadow", v)}
              options={[
                { value: "none", label: "なし" },
                { value: "sm", label: "小" },
                { value: "md", label: "中" },
                { value: "lg", label: "大" },
              ]}
            />
            <OptionRow
              label="枠線 (Border)"
              current={uiConfig.border}
              onChange={(v) => update("border", v)}
              options={[
                { value: "none", label: "なし" },
                { value: "thin", label: "細" },
                { value: "thick", label: "太" },
              ]}
            />
            <OptionRow
              label="質感"
              current={uiConfig.texture}
              onChange={(v) => update("texture", v)}
              options={[
                { value: "flat", label: "Flat" },
                { value: "glass", label: "Glass" },
                { value: "simple", label: "Simple" },
                { value: "paper", label: "Paper" },
                { value: "neon", label: "Neon" },
              ]}
            />
            <OptionRow
              label="強調グラデーション"
              current={uiConfig.useGradient}
              onChange={(v) => update("useGradient", v)}
              options={[
                { value: true, label: "ON" },
                { value: false, label: "OFF" },
              ]}
            />
            <OptionRow
              label="アイコンスタイル"
              current={uiConfig.iconStyle}
              onChange={(v) => update("iconStyle", v)}
              options={[
                { value: "lucide", label: "Lucide" },
                { value: "text", label: "Text" },
              ]}
            />
            <OptionRow
              label="アイコンの太さ"
              current={uiConfig.iconWeight || "normal"}
              onChange={(v) => update("iconWeight", v)}
              options={[
                { value: "light", label: "細い" },
                { value: "normal", label: "普通" },
                { value: "bold", label: "太い" },
              ]}
            />
            <OptionRow
              label="アニメーション"
              current={uiConfig.animation}
              onChange={(v) => update("animation", v)}
              options={[
                { value: "spring", label: "Spring" },
                { value: "blur", label: "Blur" },
                { value: "slide", label: "Slide" },
                { value: "fade", label: "Fade" },
                { value: "off", label: "Off" },
              ]}
            />
            <OptionRow
              label="マウスエフェクト"
              current={uiConfig.mouseEffect}
              onChange={(v) => update("mouseEffect", v)}
              options={[
                { value: "glow", label: "Glow" },
                { value: "none", label: "Off" },
              ]}
            />
          </Section>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in">
          <Section title="タスク名一括置換">
            <p className="text-xs opacity-60">
              API制限を避けるため、一度に最大10件ずつ置換を実行します。
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="検索文字列 (例: 課題)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full p-2.5 rounded-lg border outline-none focus:ring-2 bg-transparent"
                style={{ borderColor: "var(--ui-border)" }}
              />
              <input
                type="text"
                placeholder="置換後文字列 (例: Report)"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full p-2.5 rounded-lg border outline-none focus:ring-2 bg-transparent"
                style={{ borderColor: "var(--ui-border)" }}
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <p className="text-sm font-medium">
                一致:{" "}
                <span className="text-[var(--ui-accent)] font-bold">
                  {matchedTasks.length}
                </span>{" "}
                件
              </p>
              <button
                onClick={handleReplace}
                disabled={replacing || matchedTasks.length === 0}
                className="px-5 py-2 bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)] rounded-lg font-bold disabled:opacity-50 transition hover:brightness-110"
              >
                {replacing ? "置換中..." : `10件置換実行`}
              </button>
            </div>
          </Section>
          <div
            className="max-h-[50vh] overflow-y-auto rounded-xl border bg-black/5 dark:bg-white/5 p-2 space-y-2"
            style={{ borderColor: "var(--ui-border)" }}
          >
            {matchedTasks.length === 0 ? (
              <div className="p-12 text-center opacity-40">対象タスクなし</div>
            ) : (
              matchedTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 text-sm flex flex-col gap-2 rounded-lg border bg-[var(--ui-panel-bg)] shadow-sm"
                  style={{ borderColor: "var(--ui-border)" }}
                >
                  <div className="flex items-center gap-2 text-[var(--ui-danger)] line-through text-xs font-medium">
                    <span className="shrink-0 bg-[var(--ui-danger-bg)] px-1 rounded">
                      BEFORE
                    </span>{" "}
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2 text-[var(--ui-success)] font-bold">
                    <span className="shrink-0 bg-[var(--ui-success-bg)] px-1 rounded text-xs">
                      AFTER
                    </span>{" "}
                    {t.title.replace(new RegExp(searchText, "g"), replaceText)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 pb-8 gap-3">
        <button
          type="button"
          onClick={() =>
            setUiConfig({
              bgTheme: "light",
              radius: "md",
              font: "sans",
              weight: "normal",
              accent: "blue",
              texture: "flat",
              density: "normal",
              animation: "spring",
              mouseEffect: "glow",
              shadow: "md",
              border: "thin",
              iconStyle: "lucide",
              language: "en_mix",
              useGradient: false,
            })
          }
          className="px-4 py-2 text-sm font-bold opacity-60 hover:opacity-100 border rounded-xl transition shadow-sm bg-transparent"
          style={{ borderColor: "var(--ui-border)" }}
        >
          設定をデフォルトにリセット
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition shadow-sm flex items-center gap-2"
        >
          <LogOut size={16} /> ログアウト
        </button>
      </div>
    </div>
  );
}

function AnalyticsView({
  tasks,
  weeklyHistory,
  monthlyHistory,
  yearlyHistory,
  _overallCompletionRate,
  _totalTasks,
  _completedTasks,
  _tagStats,
  selectedTag,
  toggleTaskStatus,
  averageLeadTime,
  onTimeTasks,
  lateTasks,
  uiConfig,
  t,
  setPeriodModalPeriod,
  setPeriodModalTiltDeg,
  weekBeforeLastStats,
  lastWeekStats,
  weekAfterNextStats,
  nextMonthStats,
  monthAfterNextStats,
}) {
  const [granularity, setGranularity] = useState("week");
  const [expandedRow, setExpandedRow] = useState(null);
  const [tagPeriod, setTagPeriod] = useState("next14Days");

  const analyticsCardsScrollRef = useRef(null);
  const handleAnalyticsCardsScroll = (direction) => {
    if (analyticsCardsScrollRef.current) {
      const amount = 320;
      analyticsCardsScrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  const series =
    granularity === "week"
      ? weeklyHistory
      : granularity === "month"
        ? monthlyHistory
        : yearlyHistory;

  useEffect(() => {
    const timer = setTimeout(() => setExpandedRow(null), 0);
    return () => clearTimeout(timer);
  }, [granularity]);

  const scopeHint = selectedTag ? `（タグ「${selectedTag}」のタスクのみ）` : "";
  const chartTitle =
    granularity === "week"
      ? `週次（過去7週＋今週＋来週）${scopeHint}`
      : granularity === "month"
        ? `月次（過去12ヶ月）${scopeHint}`
        : `年次（過去5年）${scopeHint}`;

  const labelFor = (w) => {
    if (granularity === "week") {
      if (w.isCurrent) return "今週";
      if (w.isFuture) return "来週";
      return w.label;
    }
    if (granularity === "month") {
      return w.isCurrent ? "今月" : w.shortLabel || w.label;
    }
    return w.isCurrent ? "今年" : w.label;
  };

  const overdueList = useMemo(() => {
    const nowValue = Date.now();
    return tasks
      .filter(
        (t) =>
          t.status !== "completed" &&
          t.due &&
          !Number.isNaN(new Date(t.due).getTime()) &&
          new Date(t.due).getTime() < nowValue - 3 * 24 * 60 * 60 * 1000
      )
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  }, [tasks]);

  const periodData = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(now);
    const nextWeekStart = addWeeks(thisWeekStart, 1);
    const nextWeekEnd = addWeeks(nextWeekStart, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const pTasks = tasks.filter((t) => {
      // 全体フィルタ（選択されたタグがあればそれに絞る）
      if (selectedTag && selectedTag !== "未分類" && !t.tags.includes(selectedTag)) return false;
      if (selectedTag === "未分類" && t.tags.length > 0) return false;

      if (tagPeriod === "all") return true;
      if (!t.due) return false;
      const dMs = new Date(t.due).getTime();
      if (Number.isNaN(dMs)) return false;

      switch (tagPeriod) {
        case "thisWeek":
          return dMs >= thisWeekStart.getTime() && dMs < thisWeekEnd.getTime();
        case "next7Days":
          return dMs >= nowMs && dMs <= nowMs + 7 * 86400000;
        case "nextWeek":
          return dMs >= nextWeekStart.getTime() && dMs < nextWeekEnd.getTime();
        case "next14Days":
          return dMs >= nowMs && dMs <= nowMs + 14 * 86400000;
        case "thisMonth":
          return dMs >= thisMonthStart && dMs < nextMonthStart;
        default:
          return true;
      }
    });

    const td = {};
    pTasks.forEach((t) => {
      const tgs = t.tags.length === 0 ? ["未分類"] : t.tags;
      const isCompleted = t.status === "completed";
      let isOverdueTask = false;
      let compStatus = "activeOk"; // activeOk, early, ontime, late, overdue

      const dMs = t.due ? new Date(t.due).getTime() : NaN;

      if (isCompleted) {
        if (t.completed && t.due && !Number.isNaN(dMs)) {
          const cMs = new Date(t.completed).getTime();
          if (!Number.isNaN(cMs)) {
            if (cMs <= dMs - 86400000) compStatus = "early";
            else if (cMs <= dMs + 86400000) compStatus = "ontime";
            else compStatus = "late";
          } else {
            compStatus = "ontime";
          }
        } else {
          compStatus = "ontime";
        }
      } else {
        if (t.due && !Number.isNaN(dMs) && dMs < nowMs) {
          compStatus = "overdue";
          isOverdueTask = true;
        }
      }

      tgs.forEach((tag) => {
        if (!td[tag]) td[tag] = { total: 0, completed: 0, early: 0, ontime: 0, late: 0, overdue: 0, activeOk: 0 };
        td[tag].total++;
        if (isCompleted) td[tag].completed++;
        td[tag][compStatus]++;
      });
    });

    const pTagStats = Object.entries(td)
      .map(([tag, data]) => ({
        tag,
        ...data,
        rate: data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);

    return { pTasks, pTagStats };
  }, [tasks, tagPeriod, selectedTag]);

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. 横スクロール進捗カード */}
      <div className="relative group w-full">
        <button
          onClick={() => handleAnalyticsCardsScroll("left")}
          className="hidden sm:flex lg:hidden absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 items-center justify-center rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
          style={{ background: "var(--ui-panel-bg)", color: "var(--ui-text)", border: "1px solid var(--ui-border)" }}
        >
          <ChevronLeft size={18} />
        </button>

        <div
          ref={analyticsCardsScrollRef}
          className="-mx-4 lg:mx-0 px-4 lg:px-0 w-[calc(100%+2rem)] lg:w-full overflow-x-auto hide-scrollbar pt-2 pb-6"
        >
          <div className="flex lg:grid lg:grid-cols-5 gap-3 w-max lg:w-full snap-x snap-mandatory after:content-[''] after:w-4 after:shrink-0 lg:after:hidden">
            <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-auto">
              <PeriodCard
                label={t("weekBeforeLast", uiConfig.language)}
                icon={uiConfig.iconStyle !== "text" && <Calendar size={14} />}
                stats={weekBeforeLastStats}
                accent="text-[var(--ui-accent-dark)] opacity-70"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod("weekBeforeLast"); }}
              />
            </div>
            <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-auto">
              <PeriodCard
                label={t("lastWeek", uiConfig.language)}
                icon={uiConfig.iconStyle !== "text" && <Calendar size={14} />}
                stats={lastWeekStats}
                accent="text-[var(--ui-accent)] opacity-80"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod("lastWeek"); }}
              />
            </div>
            <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-auto">
              <PeriodCard
                label={t("weekAfterNext", uiConfig.language)}
                icon={uiConfig.iconStyle !== "text" && <Calendar size={14} />}
                stats={weekAfterNextStats}
                accent="text-[var(--ui-accent-dark)] opacity-70"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod("weekAfterNext"); }}
              />
            </div>
            <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-auto">
              <PeriodCard
                label={t("nextMonth", uiConfig.language)}
                icon={uiConfig.iconStyle !== "text" && <Calendar size={14} />}
                stats={nextMonthStats}
                accent="text-[var(--ui-accent-dark)] opacity-70"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod("nextMonth"); }}
              />
            </div>
            <div className="snap-center shrink-0 w-[150px] sm:w-[220px] lg:w-auto">
              <PeriodCard
                label={t("monthAfterNext", uiConfig.language)}
                icon={uiConfig.iconStyle !== "text" && <Calendar size={14} />}
                stats={monthAfterNextStats}
                accent="text-[var(--ui-accent-dark)] opacity-70"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod("monthAfterNext"); }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => handleAnalyticsCardsScroll("right")}
          className="hidden sm:flex lg:hidden absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 items-center justify-center rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
          style={{ background: "var(--ui-panel-bg)", color: "var(--ui-text)", border: "1px solid var(--ui-border)" }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 2. 複合グラフ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" /> タスク量と達成率の推移
          </h3>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
            {[
              { id: "week", label: "週次" },
              { id: "month", label: "月次" },
              { id: "year", label: "年次" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setGranularity(id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${granularity === id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">{chartTitle}</p>
        <CompositeChart series={series} labelFor={labelFor} />
      </div>

      {/* 3. 完了ペース分析 & 長期滞留アラート */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 items-start">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            完了ペース分析
          </p>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">平均完了日</span>
                <p className="text-2xl font-bold text-slate-800">
                  {averageLeadTime === 0
                    ? "当日"
                    : averageLeadTime > 0
                      ? `${averageLeadTime.toFixed(1)} 日前`
                      : `${Math.abs(averageLeadTime).toFixed(1)} 日遅延`}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${averageLeadTime >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    }`}
                >
                  {averageLeadTime >= 0 ? "良好" : "改善の余地あり"}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-emerald-600 font-bold mb-1">期限前/当日</p>
                <p className="text-lg font-bold text-emerald-700">{onTimeTasks}</p>
              </div>
              <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-amber-600 font-bold mb-1">期限後完了</p>
                <p className="text-lg font-bold text-amber-700">{lateTasks}</p>
              </div>
            </div>

            {/* 週ごとの遅延率推移 */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-2">週ごとの完了ペース推移</p>
              <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 hide-scrollbar">
                {weeklyHistory.slice(-8).reverse().map((w) => {
                  const wTasks = w.tasks || [];
                  let wEarly = 0, wOnTime = 0, wLate = 0;
                  wTasks.forEach((t) => {
                    if (t.status === "completed" && t.completed && t.due) {
                      const c = new Date(t.completed).getTime();
                      const d = new Date(t.due).getTime();
                      if (c <= d - 86400000) wEarly++;
                      else if (c <= d + 86400000) wOnTime++;
                      else wLate++;
                    }
                  });
                  const tot = Math.max(wEarly + wOnTime + wLate, 1);
                  return (
                    <div key={w.key}>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span className={w.isCurrent ? "font-bold text-indigo-600" : ""}>
                          {w.isCurrent ? "今週" : w.label}
                        </span>
                        <span>前{wEarly} / 当{wOnTime} / 遅{wLate}</span>
                      </div>
                      <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                        <div className="bg-emerald-400 transition-all" style={{ width: `${(wEarly / tot) * 100}%` }} />
                        <div className="bg-blue-400 transition-all" style={{ width: `${(wOnTime / tot) * 100}%` }} />
                        <div className="bg-rose-400 transition-all" style={{ width: `${(wLate / tot) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-red-500" /> 長期滞留アラート
          </h3>
          <p className="text-xs text-slate-500 mb-4">期限が過ぎてから3日以上放置されている未完了タスクです。</p>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1 hide-scrollbar">
            {overdueList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">長期滞留しているタスクはありません🎉</p>
            ) : (
              overdueList.map((t) => (
                <div key={t.id} className="py-3 flex justify-between items-center gap-4">
                  <span className="text-sm font-medium text-slate-700 truncate">{t.cleanTitle}</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded whitespace-nowrap">
                    {Math.floor((Date.now() - new Date(t.due).getTime()) / (1000 * 60 * 60 * 24))} 日経過
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. 完了ペース推移 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mt-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-blue-500" /> 完了ペース推移 (
          {granularity === "week" ? "週次" : granularity === "month" ? "月次" : "年次"})
        </h3>
        <p className="text-xs text-slate-500 mb-3">設定された期限に対する完了タイミング（期限設定ありのタスクのみ）</p>

        <div className="flex items-end gap-1 sm:gap-2 h-40 px-1 sm:px-2 border-b border-slate-100 overflow-x-auto">
          {series.map((w) => {
            const wTasks = w.tasks || [];
            let e = 0, o = 0, l = 0;
            wTasks.forEach((t) => {
              if (t.status === "completed" && t.completed && t.due) {
                const c = new Date(t.completed).getTime();
                const d = new Date(t.due).getTime();
                if (c <= d - 86400000) e++;
                else if (c <= d + 86400000) o++;
                else l++;
              }
            });
            const tot = e + o + l;
            const hE = tot === 0 ? 0 : (e / tot) * 100;
            const hO = tot === 0 ? 0 : (o / tot) * 100;
            const hL = tot === 0 ? 0 : (l / tot) * 100;

            const paceTotals = series && series.length > 0
              ? series.map((x) => {
                let count = 0;
                (x.tasks || []).forEach((t) => {
                  if (t.status === "completed" && t.completed && t.due) count++;
                });
                return count;
              })
              : [0];
            const maxPaceTot = Math.max(1, ...paceTotals);
            const heightPct = tot === 0 ? 0 : Math.min((tot / maxPaceTot) * 100, 100);

            return (
              <div key={w.key} className="flex-1 min-w-[28px] flex flex-col items-center justify-end h-full group relative">
                <span className="text-[10px] text-slate-600 font-bold mb-1 opacity-0 group-hover:opacity-100 transition absolute -top-6 whitespace-nowrap z-20 bg-white px-2 py-1 border border-slate-200 rounded shadow-lg pointer-events-none">
                  前:{e} 当:{o} 遅:{l}
                </span>
                <div
                  className="w-full max-w-[20px] flex flex-col justify-end overflow-hidden rounded-t-sm"
                  style={{ height: `${heightPct}%`, minHeight: tot === 0 ? "0" : "4px" }}
                >
                  <div className="w-full bg-amber-400 transition-all hover:opacity-80" style={{ height: `${hL}%` }} title={`遅延: ${l}`} />
                  <div className="w-full bg-blue-400 transition-all hover:opacity-80" style={{ height: `${hO}%` }} title={`当日: ${o}`} />
                  <div className="w-full bg-emerald-400 transition-all hover:opacity-80" style={{ height: `${hE}%` }} title={`期限前: ${e}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-2 px-1 sm:px-2 overflow-x-auto">
          {series.map((w) => (
            <div key={`lp-${w.key}`} className="flex-1 min-w-[28px] text-[9px] sm:text-[10px] text-center truncate text-slate-500">
              {labelFor(w)}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></span>期限前</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400"></span>当日</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>遅延</div>
        </div>
      </div>

      {/* 5. 詳細テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">
          {granularity === "week" ? "週次" : granularity === "month" ? "月次" : "年次"}の詳細{" "}
          <span className="text-xs font-normal text-slate-400 ml-2">行をクリックしてタスクを展開</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-4 font-medium">期間</th>
                <th className="py-2 pr-4 font-medium">対象</th>
                <th className="py-2 pr-4 font-medium">完了</th>
                <th className="py-2 pr-4 font-medium">達成率</th>
              </tr>
            </thead>
            <tbody>
              {series.slice().reverse().map((w) => {
                const isExpanded = expandedRow === w.key;
                const rowTasks = w.tasks || [];
                const tasksDone = rowTasks.filter((t) => t.status === "completed");
                const tasksUndone = rowTasks.filter((t) => t.status !== "completed");

                return (
                  <React.Fragment key={`t-${w.key}`}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : w.key)}
                      className={`border-b border-slate-50 last:border-0 cursor-pointer transition hover:bg-slate-50 ${isExpanded ? "bg-slate-50" : ""
                        }`}
                    >
                      <td className="py-2.5 pr-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-slate-300 shrink-0" />
                          )}
                          {granularity === "week" && w.isCurrent ? (
                            <span className="font-semibold text-indigo-600">今週 <span className="text-slate-400 font-normal">({w.label})</span></span>
                          ) : granularity === "week" && w.isFuture ? (
                            <span className="text-slate-500">来週 <span className="text-slate-400">({w.label})</span></span>
                          ) : (
                            w.label
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{w.total}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{w.completed}</td>
                      <td className="py-2.5 pr-4 font-semibold">
                        <span
                          className={
                            w.total === 0 ? "text-slate-300" : w.rate >= 80 ? "text-emerald-600" : w.rate >= 50 ? "text-blue-600" : "text-amber-600"
                          }
                        >
                          {w.total === 0 ? "-" : `${w.rate}%`}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="bg-slate-50 border-b border-slate-100 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                              <h5 className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 inline-block sticky top-0 z-10">
                                未達成 ({tasksUndone.length})
                              </h5>
                              {tasksUndone.length === 0 ? (
                                <p className="text-xs text-slate-400 px-1">なし</p>
                              ) : (
                                tasksUndone.map((t) => (
                                  <div key={t.id} className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-slate-200 shadow-sm">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleTaskStatus(t); }} className="mt-0.5 shrink-0">
                                      <Circle size={12} className="text-slate-300 hover:text-blue-500" />
                                    </button>
                                    <span className="text-slate-700 leading-tight">{t.cleanTitle}</span>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                              <h5 className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 inline-block sticky top-0 z-10">
                                達成済 ({tasksDone.length})
                              </h5>
                              {tasksDone.length === 0 ? (
                                <p className="text-xs text-slate-400 px-1">なし</p>
                              ) : (
                                tasksDone.map((t) => (
                                  <div key={t.id} className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-slate-200 shadow-sm opacity-70">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleTaskStatus(t); }} className="mt-0.5 shrink-0">
                                      <CheckCircle2 size={12} className="text-emerald-500" />
                                    </button>
                                    <span className="text-slate-500 line-through leading-tight">{t.cleanTitle}</span>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 inline-block">
                                期間内のタグ構成
                              </h5>
                              {(() => {
                                const periodTagCounts = {};
                                let periodTaggedTotal = 0;
                                rowTasks.forEach((t) => {
                                  const tgs = t.tags.length > 0 ? t.tags : ["未分類"];
                                  tgs.forEach((tag) => {
                                    periodTagCounts[tag] = (periodTagCounts[tag] || 0) + 1;
                                    periodTaggedTotal++;
                                  });
                                });
                                const periodTagStats = Object.entries(periodTagCounts)
                                  .map(([tag, count]) => ({
                                    tag, count, rate: Math.round((count / (periodTaggedTotal || 1)) * 100),
                                  }))
                                  .sort((a, b) => b.count - a.count);

                                return periodTagStats.length === 0 ? (
                                  <p className="text-xs text-slate-400 px-1">データなし</p>
                                ) : (
                                  <div className="space-y-2.5 mt-2 bg-white p-3 rounded border border-slate-200 shadow-sm">
                                    {periodTagStats.map((t) => (
                                      <div key={t.tag}>
                                        <div className="flex justify-between items-center text-[10px] text-slate-600 mb-1">
                                          <span className="truncate pr-2 font-medium">{t.tag}</span>
                                          <span className="shrink-0">{t.rate}% <span className="text-slate-400">({t.count})</span></span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                                          <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${t.rate}%` }} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. 新規追加: 期間別のタグ進捗・ルーチン詳細分析セクション */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b pb-4 border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-purple-600" /> 期間別の詳細タグ・ルーチン分析
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              選択した期間に含まれるタスクのタグ比率やルーチンを確認できます。
            </p>
          </div>
          <div className="bg-slate-100 p-1 rounded-lg w-fit shrink-0">
            <AnimatedToggle
              options={[
                { value: "all", label: "すべて" },
                { value: "thisWeek", label: "今週" },
                { value: "next7Days", label: "7日以内" },
                { value: "nextWeek", label: "来週" },
                { value: "next14Days", label: "14日以内" },
                { value: "thisMonth", label: "今月" },
              ]}
              current={tagPeriod}
              onChange={setTagPeriod}
              optionClassName="!px-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
              タグ別 進捗詳細内訳
            </h4>
            {periodData.pTagStats.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                この期間に該当するタスクはありません
              </p>
            ) : (
              <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 hide-scrollbar">
                {periodData.pTagStats.map((t) => (
                  <div key={t.tag}>
                    <div className="flex justify-between items-center text-sm font-medium mb-1.5">
                      <span className="text-slate-700">{t.tag}</span>
                      <span className="text-slate-500 text-xs">
                        達成率 {t.rate}% ({t.completed}/{t.total})
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden border border-slate-200">
                      <div
                        className="bg-emerald-400 hover:brightness-110 transition-all"
                        style={{ width: `${(t.early / t.total) * 100}%` }}
                        title={`期限前: ${t.early}`}
                      />
                      <div
                        className="bg-blue-400 hover:brightness-110 transition-all"
                        style={{ width: `${(t.ontime / t.total) * 100}%` }}
                        title={`当日/期限なし完了: ${t.ontime}`}
                      />
                      <div
                        className="bg-amber-400 hover:brightness-110 transition-all"
                        style={{ width: `${(t.late / t.total) * 100}%` }}
                        title={`遅延完了: ${t.late}`}
                      />
                      <div
                        className="bg-red-400 hover:brightness-110 transition-all"
                        style={{ width: `${(t.overdue / t.total) * 100}%` }}
                        title={`未完了(超過): ${t.overdue}`}
                      />
                      <div
                        className="bg-slate-300 hover:brightness-110 transition-all"
                        style={{ width: `${(t.activeOk / t.total) * 100}%` }}
                        title={`未完了(余裕あり): ${t.activeOk}`}
                      />
                    </div>
                    {/* 詳細ラベル */}
                    <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] font-medium text-slate-400">
                      {t.early > 0 && <span className="text-emerald-600">前:{t.early}</span>}
                      {t.ontime > 0 && <span className="text-blue-600">当:{t.ontime}</span>}
                      {t.late > 0 && <span className="text-amber-600">遅:{t.late}</span>}
                      {t.overdue > 0 && <span className="text-red-500 bg-red-50 px-1 rounded">超過:{t.overdue}</span>}
                      {t.activeOk > 0 && <span>未:{t.activeOk}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
              該当期間内の未完了タスク・ルーチン候補
            </h4>
            <div className="bg-slate-50 rounded-lg p-3 max-h-[400px] overflow-y-auto hide-scrollbar">
              {periodData.pTasks.filter((t) => t.status !== "completed")
                .length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  未完了タスクなし🎉
                </p>
              ) : (
                <ul className="space-y-2">
                  {periodData.pTasks
                    .filter((t) => t.status !== "completed")
                    .map((t) => {
                      const isOverdueTask = t.due && new Date(t.due).getTime() < new Date().getTime();
                      return (
                        <li
                          key={t.id}
                          className={`text-sm flex items-start gap-2 bg-white p-2.5 rounded-lg border shadow-sm ${isOverdueTask ? "border-red-200 bg-red-50/50" : "border-slate-100 text-slate-600"
                            }`}
                        >
                          <AlertCircle
                            size={14}
                            className={`mt-0.5 shrink-0 ${isOverdueTask ? "text-red-500" : "text-amber-500"}`}
                          />
                          <div>
                            <span className={`font-medium block leading-tight mb-1 ${isOverdueTask ? "text-red-700" : ""}`}>
                              {t.cleanTitle}
                            </span>
                            <span className={`text-[10px] font-bold ${isOverdueTask ? "text-red-500" : "text-slate-400"}`}>
                              期限: {formatDue(t.due) || "なし"}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrganizeView({
  tasks,
  uiConfig,
  t,
  toggleTaskStatus,
  getTagColor,
  selectedTasks,
  toggleSelection,
  setSelectedTasks,
  handleDeleteSelected,
  showCheckboxes,
  selectionMode,
  setSelectionMode,
  showCompleted,
  setShowCompleted,
}) {
  const [organizeSubTab, setOrganizeSubTab] = useState("tags");
  const [organizePeriod, setOrganizePeriod] = useState("all");

  const orgTasks = useMemo(() => {
    if (organizePeriod === "all") return tasks;
    const now = new Date();
    const nowMs = now.getTime();
    const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange(now);
    const nextWeekStart = addWeeks(thisWeekStart, 1);
    const nextWeekEnd = addWeeks(nextWeekStart, 1);
    const thisMonthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();
    const nextMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    ).getTime();

    return tasks.filter((t) => {
      if (!t.due) return false;
      const dMs = new Date(t.due).getTime();
      if (Number.isNaN(dMs)) return false;

      switch (organizePeriod) {
        case "thisWeek":
          return dMs >= thisWeekStart.getTime() && dMs < thisWeekEnd.getTime();
        case "next7Days":
          return dMs >= nowMs && dMs <= nowMs + 7 * 86400000;
        case "nextWeek":
          return dMs >= nextWeekStart.getTime() && dMs < nextWeekEnd.getTime();
        case "next14Days":
          return dMs >= nowMs && dMs <= nowMs + 14 * 86400000;
        case "thisMonth":
          return dMs >= thisMonthStart && dMs < nextMonthStart;
        default:
          return true;
      }
    });
  }, [tasks, organizePeriod]);

  const orgTagStats = useMemo(() => {
    const td = {};
    orgTasks.forEach((t) => {
      const tgs = t.tags.length === 0 ? ["未分類"] : t.tags;
      tgs.forEach((tag) => {
        if (!td[tag]) td[tag] = { total: 0, completed: 0 };
        td[tag].total++;
        if (t.status === "completed") td[tag].completed++;
      });
    });
    return Object.entries(td)
      .map(([tag, data]) => ({
        tag,
        ...data,
        rate:
          data.total === 0
            ? 0
            : Math.round((data.completed / data.total) * 100),
        active: data.total - data.completed,
      }))
      .sort((a, b) => b.total - a.total);
  }, [orgTasks]);

  const orgRoutineGroups = useMemo(() => {
    const wc = {};
    orgTasks.forEach((t) => {
      (t.cleanTitle || "")
        .split(/[\s,，、・\-()（）[\]［］{}｛｝]+/)
        .forEach((w) => {
          if (w.length < 2 || /^[0-9０-９]+$/.test(w)) return;
          if (/課題[0-9０-９]+/.test(w) || /[0-9０-９]+回/.test(w)) return;
          wc[w] = (wc[w] || 0) + 1;
        });
    });
    const th = 3;
    const rKws = Object.keys(wc).filter((w) => wc[w] >= th);
    const tGroups = {};
    orgTasks.forEach((t) => {
      [
        ...new Set(
          (t.cleanTitle || "")
            .split(/[\s,，、・\-()（）[\]［］{}｛｝]+/)
            .filter((w) => rKws.includes(w))
        ),
      ].forEach((kw) => {
        if (!tGroups[kw])
          tGroups[kw] = {
            title: [kw],
            count: 0,
            completedCount: 0,
            tasks: [],
            taskIds: new Set(),
          };
        tGroups[kw].count += 1;
        tGroups[kw].tasks.push(t);
        tGroups[kw].taskIds.add(t.id);
        if (t.status === "completed") tGroups[kw].completedCount += 1;
      });
    });
    const merged = [];
    Object.values(tGroups).forEach((g) => {
      if (g.count < th) return;
      const ex = merged.find(
        (mg) =>
          mg.taskIds.size === g.taskIds.size &&
          [...mg.taskIds].every((id) => g.taskIds.has(id))
      );
      if (ex) ex.title.push(...g.title);
      else merged.push(g);
    });
    return merged
      .map((g) => ({
        ...g,
        titleLabel: g.title.join(" / "),
        activeCount: g.count - g.completedCount,
      }))
      .sort((a, b) => b.activeCount - a.activeCount || b.count - a.count);
  }, [orgTasks]);

  return (
    <div className="space-y-4 min-w-0">
      <div
        className="flex flex-col lg:flex-row lg:items-center gap-3 border-b pb-4"
        style={{ borderColor: "var(--ui-border)" }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Layers size={22} className="opacity-70" />
          <h2 className="text-xl font-bold">
            {t("organize", uiConfig.language)}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 lg:ml-auto shrink-0">
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl w-fit">
            <AnimatedToggle
              options={[
                { value: "all", label: "すべて" },
                { value: "thisWeek", label: "今週" },
                { value: "next7Days", label: "7日以内" },
                { value: "nextWeek", label: "来週" },
                { value: "next14Days", label: "14日以内" },
                { value: "thisMonth", label: "今月" },
              ]}
              current={organizePeriod}
              onChange={setOrganizePeriod}
            />
          </div>
          <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl w-fit">
            <button
              onClick={() => setOrganizeSubTab("tags")}
              className={`px-4 py-1.5 text-sm font-bold rounded-lg transition flex items-center gap-1.5 ${organizeSubTab === "tags"
                  ? "bg-[var(--ui-panel-bg)] shadow-sm text-[var(--ui-text)]"
                  : "text-[var(--ui-text-muted)] opacity-60 hover:opacity-100"
                }`}
            >
              <Tag size={14} /> タグ管理
            </button>
            <button
              onClick={() => setOrganizeSubTab("routines")}
              className={`px-4 py-1.5 text-sm font-bold rounded-lg transition flex items-center gap-1.5 ${organizeSubTab === "routines"
                  ? "bg-[var(--ui-panel-bg)] shadow-sm text-[var(--ui-text)]"
                  : "text-[var(--ui-text-muted)] opacity-60 hover:opacity-100"
                }`}
            >
              <RotateCcw size={14} /> ルーチン管理
            </button>
          </div>
        </div>
      </div>
      {organizeSubTab === "tags" ? (
        <TagManagerView
          tagStats={orgTagStats}
          tasks={orgTasks}
          toggleTaskStatus={toggleTaskStatus}
          getTagColor={getTagColor}
          selectedTasks={selectedTasks}
          toggleSelection={toggleSelection}
          setSelectedTasks={setSelectedTasks}
          handleDeleteSelected={handleDeleteSelected}
          showCheckboxes={showCheckboxes}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          showCompleted={showCompleted}
          setShowCompleted={setShowCompleted}
        />
      ) : (
        <RoutineDetectorView
          routineGroups={orgRoutineGroups}
          selectedRoutine={null}
          toggleTaskStatus={toggleTaskStatus}
          selectedTasks={selectedTasks}
          toggleSelection={toggleSelection}
          setSelectedTasks={setSelectedTasks}
          handleDeleteSelected={handleDeleteSelected}
          showCheckboxes={showCheckboxes}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          showCompleted={showCompleted}
          setShowCompleted={setShowCompleted}
        />
      )}
    </div>
  );
}
