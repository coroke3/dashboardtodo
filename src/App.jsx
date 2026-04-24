import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Circle, AlertCircle, Play, Tag, LogOut,
  RefreshCw, LayoutDashboard, ListTodo, Calendar,
  Plus, X, History, Target, TrendingUp, BarChart3, CalendarOff,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Copy,
  Search, Layers, PieChart, Settings, Flame, Clock, Inbox, CheckSquare,
  ChevronRight as ChevronRightIcon, ChevronDown as ChevronDownIcon,
} from 'lucide-react';

const today = new Date();
const threeDaysAgo = new Date(today); threeDaysAgo.setDate(today.getDate() - 3);
const tenDaysAgo = new Date(today); tenDaysAgo.setDate(today.getDate() - 10);
const twentyDaysAgo = new Date(today); twentyDaysAgo.setDate(today.getDate() - 20);
const thirtyFiveDaysAgo = new Date(today); thirtyFiveDaysAgo.setDate(today.getDate() - 35);

const iso = (d) => d.toISOString();

const MOCK_TASKS = [
  { id: "1", listId: "demo", title: "[univ][rpt] ソフトウェア工学 中間レポート作成", status: "needsAction", due: iso(new Date(today.getTime() + 5 * 86400000)) },
  { id: "2", listId: "demo", title: "[private] スーパーで夕食の買い出し", status: "needsAction", due: iso(new Date(today.getTime() + 86400000)) },
  { id: "3", listId: "demo", title: "[univ][lit] HCI関連の論文を3本読む", status: "completed", due: iso(threeDaysAgo), completed: iso(threeDaysAgo) },
  { id: "4", listId: "demo", title: "部屋の掃除とゴミ出し", status: "needsAction" },
  { id: "5", listId: "demo", title: "[rpt] アルバイトのシフト希望提出", status: "needsAction", due: iso(new Date(today.getTime() + 2 * 86400000)) },
  { id: "6", listId: "demo", title: "[univ][private] 友人との勉強会", status: "needsAction" },
  { id: "7", listId: "demo", title: "[lit] 新刊の技術書を読む", status: "completed", due: iso(tenDaysAgo), completed: iso(tenDaysAgo) },
  { id: "8", listId: "demo", title: "[univ] 授業の履修登録", status: "completed", due: iso(today), completed: iso(today) },
  { id: "9", listId: "demo", title: "[rpt] 先月の月次レポート提出", status: "completed", due: iso(twentyDaysAgo), completed: iso(twentyDaysAgo) },
  { id: "10", listId: "demo", title: "[univ] 数学演習", status: "completed", due: iso(thirtyFiveDaysAgo), completed: iso(thirtyFiveDaysAgo) },
  { id: "11", listId: "demo", title: "[univ] moodle で課題 Canvas 確認", status: "needsAction", due: iso(new Date(today.getTime() + 3 * 86400000)) },
];

const SCOPES = 'https://www.googleapis.com/auth/tasks';
const FETCH_MAX_RESULTS = 999;

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

const GOOGLE_TASKS_OAUTH_STORAGE_KEY = 'google_tasks_oauth_v1';
const OAUTH_EXPIRY_SKEW_MS = 60_000;

const readStoredOAuth = (clientId) => {
  if (!clientId) return null;
  try {
    const raw = localStorage.getItem(GOOGLE_TASKS_OAUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.clientId !== clientId) return null;
    if (typeof data.accessToken !== 'string' || typeof data.expiresAt !== 'number') return null;
    return data;
  } catch {
    return null;
  }
};

const writeStoredOAuth = (clientId, accessToken, expiresInSec) => {
  const sec = typeof expiresInSec === 'number' && expiresInSec > 0 ? expiresInSec : 3600;
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
  (localStorage.getItem('google_tasks_client_id') || ENV_CLIENT_ID || '').trim();

// === 翻訳辞書 (3段階の言語/演出モード) ===
const I18N = {
  active: { ja: 'アクティブ', en_mix: 'Active', en: 'Active Tasks' },
  history: { ja: '履歴', en_mix: 'History', en: 'History' },
  calendar: { ja: 'カレンダー', en_mix: 'Calendar', en: 'Calendar' },
  analytics: { ja: '分析ダッシュボード', en_mix: 'Analytics', en: 'Analytics' },
  routines: { ja: 'ルーチン検出', en_mix: 'Routines', en: 'Routines' },
  tags: { ja: 'タグ管理', en_mix: 'Tags', en: 'Tags' },
  replace: { ja: 'タスク一括置換', en_mix: 'Replace', en: 'Batch Replace' },
  settings: { ja: 'UI設定', en_mix: 'UI Settings', en: 'Settings' },
  search: { ja: '検索...', en_mix: 'Search...', en: 'Search...' },
  refresh: { ja: '更新', en_mix: 'Refresh', en: 'Refresh' },
  logout: { ja: '切断', en_mix: 'Logout', en: 'Logout' },
  all: { ja: 'すべて', en_mix: 'All', en: 'All' },
  weeklyProgress: { ja: '今週の達成率', en_mix: 'Weekly Progress', en: 'Weekly Progress' },
  completed: { ja: '完了', en_mix: 'Done', en: 'Completed' },
  total: { ja: '全体', en_mix: 'Total', en: 'Total' },
  thisWeek: { ja: '今週', en_mix: 'This Wk', en: 'This Week' },
  nextWeek: { ja: '来週', en_mix: 'Next Wk', en: 'Next Week' },
  thisMonth: { ja: '今月', en_mix: 'This Mo', en: 'This Month' },
};
const t = (key, lang) => I18N[key]?.[lang] || key;

// === UIテーマプリセット (実在のハイクオリティデザインを分析・オマージュした30選) ===
const THEME_PRESETS = [
  // モノクロ・ミニマル系 (映像・写真を引き立てる額縁)
  { id: '1', name: 'Studio Noir', config: { bgTheme: 'pitchBlack', radius: 'none', font: 'sans', weight: 'light', accent: 'white', texture: 'flat', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en' } },
  { id: '2', name: 'Pure White', config: { bgTheme: 'white', radius: 'none', font: 'sans', weight: 'normal', accent: 'black', texture: 'flat', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en_mix' } },
  { id: '3', name: 'Gallery Slate', config: { bgTheme: 'gray', radius: 'sm', font: 'sans', weight: 'normal', accent: 'zinc', texture: 'simple', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en_mix' } },
  
  // エディトリアル・紙系 (雑誌のようなレイアウト、セリフ体の美しさ)
  { id: '4', name: 'Editorial Serif', config: { bgTheme: 'paper', radius: 'none', font: 'shippori', weight: 'medium', accent: 'black', texture: 'paper', density: 'loose', animation: 'smooth', iconStyle: 'text', widgetDecor: 'none', language: 'ja' } },
  { id: '5', name: 'Old Sepia', config: { bgTheme: 'sepia', radius: 'sm', font: 'zenOld', weight: 'medium', accent: 'bronze', texture: 'paper', density: 'normal', animation: 'off', iconStyle: 'text', widgetDecor: 'none', language: 'ja' } },
  { id: '6', name: 'Classic Cream', config: { bgTheme: 'cream', radius: 'md', font: 'serif', weight: 'normal', accent: 'gold', texture: 'simple', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en_mix' } },
  
  // ギーク・サイバー系 (エディタ画面、ネオンカラー、グリッチ)
  { id: '7', name: 'Hacker Terminal', config: { bgTheme: 'pitchBlack', radius: 'none', font: 'mono', weight: 'normal', accent: 'emerald', texture: 'flat', density: 'compact', animation: 'smooth', iconStyle: 'text', widgetDecor: 'none', language: 'en' } },
  { id: '8', name: 'Cyber Neon', config: { bgTheme: 'navy', radius: 'sm', font: 'mono', weight: 'bold', accent: 'cyan', texture: 'neon', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'target', language: 'en' } },
  { id: '9', name: 'Synthwave', config: { bgTheme: 'dark', radius: 'none', font: 'mono', weight: 'bold', accent: 'fuchsia', texture: 'neon', density: 'compact', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'target', language: 'en' } },
  
  // ポップ・カジュアル系 (丸みを帯びたフォント、親しみやすさ)
  { id: '10', name: 'Pop Candy', config: { bgTheme: 'light', radius: 'xl', font: 'rounded', weight: 'bold', accent: 'rose', texture: 'flat', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'sparkle', language: 'ja' } },
  { id: '11', name: 'Line Seed Green', config: { bgTheme: 'white', radius: 'xl', font: 'lineSeed', weight: 'bold', accent: 'emerald', texture: 'simple', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'ja' } },
  { id: '12', name: 'Amber Sunset', config: { bgTheme: 'cream', radius: 'lg', font: 'rounded', weight: 'medium', accent: 'amber', texture: 'glass', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'sparkle', language: 'ja' } },
  
  // プロフェッショナル・コーポレート系 (信頼感、青や紺の配色)
  { id: '13', name: 'Corporate Blue', config: { bgTheme: 'light', radius: 'sm', font: 'sans', weight: 'medium', accent: 'blue', texture: 'flat', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'ja' } },
  { id: '14', name: 'Tech Indigo', config: { bgTheme: 'gray', radius: 'md', font: 'sans', weight: 'normal', accent: 'indigo', texture: 'glass', density: 'compact', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'target', language: 'en_mix' } },
  { id: '15', name: 'Deep Teal', config: { bgTheme: 'dark', radius: 'md', font: 'sans', weight: 'normal', accent: 'teal', texture: 'simple', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en_mix' } },
  
  // ガラス・透明感系 (ブラー効果、重なり合うレイアウト)
  { id: '16', name: 'Frosted Glass', config: { bgTheme: 'gray', radius: 'lg', font: 'sans', weight: 'light', accent: 'white', texture: 'glass', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'sparkle', language: 'en' } },
  { id: '17', name: 'Ocean Blur', config: { bgTheme: 'navy', radius: 'xl', font: 'sans', weight: 'medium', accent: 'cyan', texture: 'glass', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en_mix' } },
  { id: '18', name: 'Rose Water', config: { bgTheme: 'light', radius: 'lg', font: 'shippori', weight: 'medium', accent: 'rose', texture: 'glass', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'sparkle', language: 'ja' } },
  
  // モダン・アーティスティック系 (極太フォント、ディストーション)
  { id: '19', name: 'Dynamic Bold', config: { bgTheme: 'white', radius: 'none', font: 'zenKakuAntique', weight: 'black', accent: 'black', texture: 'liquid', density: 'compact', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'en_mix' } },
  { id: '20', name: 'Brutalism', config: { bgTheme: 'light', radius: 'none', font: 'bizUD', weight: 'bold', accent: 'blue', texture: 'flat', density: 'compact', animation: 'off', iconStyle: 'text', widgetDecor: 'target', language: 'en' } },
  { id: '21', name: 'Elegant Violet', config: { bgTheme: 'dark', radius: 'md', font: 'serif', weight: 'normal', accent: 'violet', texture: 'simple', density: 'loose', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'ja' } },
  
  // その他 バリエーション
  { id: '22', name: 'Forest Echo', config: { bgTheme: 'dark', radius: 'sm', font: 'zenOld', weight: 'medium', accent: 'emerald', texture: 'paper', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'ja' } },
  { id: '23', name: 'Midnight Gold', config: { bgTheme: 'navy', radius: 'none', font: 'serif', weight: 'normal', accent: 'gold', texture: 'flat', density: 'loose', animation: 'smooth', iconStyle: 'text', widgetDecor: 'none', language: 'en_mix' } },
  { id: '24', name: 'Sandstone', config: { bgTheme: 'paper', radius: 'md', font: 'sans', weight: 'normal', accent: 'sand', texture: 'simple', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'ja' } },
  { id: '25', name: 'Gamer Pink', config: { bgTheme: 'pitchBlack', radius: 'lg', font: 'mono', weight: 'bold', accent: 'rose', texture: 'neon', density: 'compact', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'target', language: 'en' } },
  { id: '26', name: 'Chalkboard', config: { bgTheme: 'gray', radius: 'none', font: 'mono', weight: 'medium', accent: 'slate', texture: 'paper', density: 'loose', animation: 'off', iconStyle: 'text', widgetDecor: 'none', language: 'en' } },
  { id: '27', name: 'Clear Sky', config: { bgTheme: 'white', radius: 'xl', font: 'rounded', weight: 'bold', accent: 'cyan', texture: 'glass', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'sparkle', language: 'ja' } },
  { id: '28', name: 'Autumn Leaf', config: { bgTheme: 'sepia', radius: 'md', font: 'shippori', weight: 'bold', accent: 'rose', texture: 'simple', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'none', language: 'ja' } },
  { id: '29', name: 'Night City', config: { bgTheme: 'dark', radius: 'lg', font: 'sans', weight: 'normal', accent: 'fuchsia', texture: 'glass', density: 'compact', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'neon', language: 'en_mix' } },
  { id: '30', name: 'Absolute Zero', config: { bgTheme: 'pitchBlack', radius: 'none', font: 'sans', weight: 'black', accent: 'white', texture: 'liquid', density: 'compact', animation: 'smooth', iconStyle: 'text', widgetDecor: 'none', language: 'en' } },
];

// === 選択要素のスライドアニメーション用コンポーネント ===
function AnimatedToggle({ options, current, onChange, className = "", optionClassName = "", isTextIcon = false }) {
  const containerRef = useRef(null);
  const [highlightStyle, setHighlightStyle] = useState({ left: 0, width: 0, opacity: 0, ready: false });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeIndex = options.findIndex(o => o.value === current);
    if (activeIndex === -1) return;
    
    // 背景ハイライト要素を避けて、実際のボタン要素だけを取得する
    const buttons = Array.from(containerRef.current.querySelectorAll(':scope > button'));
    const target = buttons[activeIndex];
    
    if (target) {
      setHighlightStyle(prev => ({
        left: target.offsetLeft,
        width: target.offsetWidth,
        opacity: 1,
        ready: true // 初回セット後にアニメーションを有効にする
      }));
    }
  }, [current, options]);

  return (
    <div ref={containerRef} className={`relative flex flex-wrap gap-1 p-1 ${className}`}>
      {/* 背景ハイライト要素 */}
      <div 
        className="absolute top-1 bottom-1 rounded-md pointer-events-none ui-highlight-bg"
        style={{
          left: highlightStyle.left,
          width: highlightStyle.width,
          opacity: highlightStyle.opacity,
          transition: highlightStyle.ready ? 'all var(--ui-transition) cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
        }}
      />
      {options.map(({ value, label, textIcon, icon: Icon }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors duration-300 ${optionClassName} ${
              isActive ? 'text-[var(--ui-accent)] font-bold' : 'text-[var(--ui-text-muted)] hover:bg-slate-500/10 font-medium'
            }`}
          >
            {isTextIcon && textIcon ? <span className="font-mono font-bold">[{textIcon}]</span> : Icon && <Icon size={14} />}
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
  return `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()}`;
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const formatDue = (dueString) => {
  if (!dueString) return null;
  const d = new Date(dueString);

  // UTCでの時刻が00:00:00の場合は「日付のみ指定（時間は未指定）」とみなす
  const isDateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const w = WEEKDAYS[d.getDay()];

  if (!isDateOnly) {
    const hh = d.getHours();
    const mi = d.getMinutes();
    const hstr = String(hh).padStart(2, '0');
    const mstr = String(mi).padStart(2, '0');
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
const toDatetimeLocalValue = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const sameLocalDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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

const dueMatchesCalendarDay = (dueString, dayDate) => {
  const parts = dueCalendarDayParts(dueString);
  if (!parts) return false;
  return parts.y === dayDate.getFullYear() && parts.mo === dayDate.getMonth() && parts.d === dayDate.getDate();
};

const CAL_WEEK_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const ACTIVE_SECTION_TITLES = [
  '期限切れ',
  '今日',
  '明日',
  'それ以外の今週',
  'それ以降',
  '期限なし',
];

/** アクティブ並び: 0期限切れ 1今日 2明日 3それ以外の今週 4それ以降 5期限なし */
const getActiveSortKey = (task, now, weekStart, weekEnd) => {
  if (!task.due) return { bucket: 5, dueMs: Number.POSITIVE_INFINITY };
  const due = new Date(task.due);
  const dueMs = due.getTime();
  if (isOverdue(task.due)) return { bucket: 0, dueMs };

  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);

  if (sameLocalDay(due, now)) return { bucket: 1, dueMs };
  if (sameLocalDay(due, tmr)) return { bucket: 2, dueMs };
  if (due >= weekStart && due < weekEnd) return { bucket: 3, dueMs };
  return { bucket: 4, dueMs };
};

/** タイトル内の LMS 名（単語境界・大文字小文字無視）を検出用 */
const LMS_IN_TITLE = [
  { re: /\bmoodle\b/i, label: 'Moodle' },
  { re: /\bcanvas\b/i, label: 'Canvas' },
  { re: /\bclassroom\b/i, label: 'Classroom' },
];

const getLmsBadgeClass = (label) => {
  if (label === 'Moodle') return 'bg-orange-50 text-orange-800 border-orange-200';
  if (label === 'Canvas') return 'bg-sky-50 text-sky-800 border-sky-200';
  if (label === 'Classroom') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function App() {
  const [clientId, setClientId] = useState(
    () => localStorage.getItem('google_tasks_client_id') || ENV_CLIENT_ID || ''
  );
  const [clientIdOverrideOpen, setClientIdOverrideOpen] = useState(!ENV_CLIENT_ID);
  const [accessToken, setAccessToken] = useState(() => {
    const cid = effectiveClientId();
    if (!cid) return null;
    const stored = readStoredOAuth(cid);
    if (stored && stored.expiresAt > Date.now() + 30_000) return stored.accessToken;
    return null;
  });
  const silentAuthTried = useRef(false);
  const [isDemo, setIsDemo] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'calendar' | 'analytics' | 'routines' | 'advanced'
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTags, setNewTaskTags] = useState([]);
  const [newTaskDue, setNewTaskDue] = useState('');
  const [showOnlyNoDue, setShowOnlyNoDue] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [routineShowCompleted, setRoutineShowCompleted] = useState(true);
  const [tagShowCompleted, setTagShowCompleted] = useState(true);
  const [uiConfig, setUiConfig] = useState(() => {
    const fallback = { bgTheme: 'light', radius: 'md', font: 'sans', weight: 'normal', accent: 'blue', texture: 'flat', density: 'normal', animation: 'smooth', iconStyle: 'lucide', widgetDecor: 'target', language: 'en_mix' };
    try {
      const s = localStorage.getItem('task_dashboard_ui_v5');
      const parsed = s ? JSON.parse(s) : null;
      return (parsed && typeof parsed === 'object') ? { ...fallback, ...parsed } : fallback;
    } catch { return fallback; }
  });

  useEffect(() => {
    localStorage.setItem('task_dashboard_ui_v5', JSON.stringify(uiConfig));
  }, [uiConfig]);

  const palette = {
    blue: { main: '#2563eb', dark: '#1d4ed8', light: '#eff6ff', border: '#bfdbfe', contrast: '#ffffff' },
    indigo: { main: '#4f46e5', dark: '#4338ca', light: '#eef2ff', border: '#c7d2fe', contrast: '#ffffff' },
    emerald: { main: '#059669', dark: '#047857', light: '#ecfdf5', border: '#a7f3d0', contrast: '#ffffff' },
    teal: { main: '#0d9488', dark: '#0f766e', light: '#f0fdfa', border: '#99f6e4', contrast: '#ffffff' },
    cyan: { main: '#0891b2', dark: '#0e7490', light: '#ecfeff', border: '#a5f3fc', contrast: '#ffffff' },
    rose: { main: '#e11d48', dark: '#be123c', light: '#fff1f2', border: '#fecdd3', contrast: '#ffffff' },
    fuchsia: { main: '#c026d3', dark: '#a21caf', light: '#fdf4ff', border: '#f5d0fe', contrast: '#ffffff' },
    amber: { main: '#d97706', dark: '#b45309', light: '#fffbeb', border: '#fde68a', contrast: '#ffffff' },
    violet: { main: '#7c3aed', dark: '#6d28d9', light: '#f5f3ff', border: '#ddd6fe', contrast: '#ffffff' },
    slate: { main: '#64748b', dark: '#475569', light: '#f8fafc', border: '#e2e8f0', contrast: '#ffffff' },
    zinc: { main: '#52525b', dark: '#3f3f46', light: '#fafafa', border: '#e4e4e7', contrast: '#ffffff' },
    white: { main: '#ffffff', dark: '#f1f5f9', light: '#ffffff', border: '#e5e5e5', contrast: '#0f172a' },
    black: { main: '#09090b', dark: '#000000', light: '#27272a', border: '#3f3f46', contrast: '#ffffff' },
    gold: { main: '#d4af37', dark: '#b5952f', light: '#fbf8ef', border: '#eaddb0', contrast: '#ffffff' },
    bronze: { main: '#cd7f32', dark: '#a36528', light: '#fcf4ed', border: '#e8cdb5', contrast: '#ffffff' },
    sand: { main: '#e7e5e4', dark: '#d6d3d1', light: '#fafaf9', border: '#f5f5f4', contrast: '#1c1917' }
  };

  const bgThemes = {
    white: { bg: '#ffffff', text: '#0f172a', textMuted: '#64748b', panel: '#ffffff', border: '#f1f5f9' },
    light: { bg: '#f8fafc', text: '#1e293b', textMuted: '#64748b', panel: '#ffffff', border: '#e2e8f0' },
    paper: { bg: '#fdfcf8', text: '#3f3e3a', textMuted: '#8b8a84', panel: '#ffffff', border: '#f5f4ef' },
    gray: { bg: '#e5e7eb', text: '#1f2937', textMuted: '#6b7280', panel: '#f3f4f6', border: '#d1d5db' },
    dark: { bg: '#1e293b', text: '#f8fafc', textMuted: '#94a3b8', panel: '#0f172a', border: '#334155' },
    navy: { bg: '#0a0a2a', text: '#e0e7ff', textMuted: '#818cf8', panel: '#05051a', border: '#1e1e4a' },
    pitchBlack: { bg: '#000000', text: '#ffffff', textMuted: '#a1a1aa', panel: '#09090b', border: '#27272a' },
    cream: { bg: '#fefce8', text: '#451a03', textMuted: '#92400e', panel: '#fffbeb', border: '#fef3c7' },
    sepia: { bg: '#f3e8d2', text: '#433422', textMuted: '#8a7156', panel: '#fdf8ee', border: '#e6d5b8' }
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
    lineSeed: '"LINE Seed JP", sans-serif'
  };

  const weightSettings = {
    light: { base: 300, medium: 400, bold: 500, black: 700 },
    normal: { base: 400, medium: 500, bold: 700, black: 900 },
    medium: { base: 500, medium: 600, bold: 800, black: 900 },
    bold: { base: 700, medium: 800, bold: 900, black: 900 },
    black: { base: 900, medium: 900, bold: 900, black: 900 },
  };
  const currentWeight = weightSettings[uiConfig.weight] || weightSettings.normal;

  const radiusMap = { none: '0px', sm: '4px', md: '8px', lg: '16px', xl: '24px' };
  
  // 余白設定（モバイルでの破綻を防ぎつつ、美しいバランスを保つ）
  const densityValues = {
    compact: { gap: '0.75rem', p: '1rem' },
    normal: { gap: '1.25rem', p: '1.5rem' },
    loose: { gap: '2rem', p: '2rem' }
  };

  const [shiftHeld, setShiftHeld] = useState(false);
  const [taskFormExpanded, setTaskFormExpanded] = useState(false);
  const [calendarMode, setCalendarMode] = useState('month');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [periodModalPeriod, setPeriodModalPeriod] = useState(null);
  const [periodModalTiltDeg, setPeriodModalTiltDeg] = useState(0);
  const [keyboardFocusedTaskId, setKeyboardFocusedTaskId] = useState(null);

  const showCheckboxes = selectionMode || shiftHeld;
  const PERIOD_MODAL_ORDER = useMemo(() => ['week', 'nextWeek', 'month'], []);

  useEffect(() => {
    const onKeyUp = (e) => {
      if (e.key === 'Shift') setShiftHeld(false);
    };
    const onBlur = () => setShiftHeld(false);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google || silentAuthTried.current) return;
      const cid = effectiveClientId();
      if (!cid) return;
      const stored = readStoredOAuth(cid);
      const autoLogin = localStorage.getItem('google_tasks_auto_login');

      if (stored && stored.expiresAt > Date.now() + 30_000) {
        setAccessToken(stored.accessToken);
        return;
      }

      if (autoLogin === 'true') {
        silentAuthTried.current = true;
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: cid,
            scope: SCOPES,
            callback: (response) => {
              if (response.error) return;
              writeStoredOAuth(cid, response.access_token, response.expires_in);
              setAccessToken(response.access_token);
            },
          });
          client.requestAccessToken({ prompt: 'none' });
        } catch {
          silentAuthTried.current = false;
        }
      }
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!accessToken || isDemo) return;
    fetchRealTasks(accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isDemo]);

  const parseTask = (task) => {
    const tagRegex = /\[(.*?)\]/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(task.title)) !== null) {
      if (match[1].trim() !== '') {
        tags.push(match[1].toLowerCase());
      }
    }
    let withoutTags = task.title.replace(/\[(.*?)\]/g, '').trim();
    const platforms = [];
    for (const { re, label } of LMS_IN_TITLE) {
      if (re.test(withoutTags) && !platforms.includes(label)) {
        platforms.push(label);
      }
    }
    let cleanTitle = withoutTags;
    for (const { re } of LMS_IN_TITLE) {
      cleanTitle = cleanTitle.replace(re, ' ');
    }
    cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

    let combinedDue = task.due;
    const notes = task.notes || '';
    const timeMatch = notes.match(/\[time:(\d{2}):(\d{2})\]/);
    if (combinedDue && timeMatch) {
      const d = new Date(combinedDue);
      d.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      combinedDue = d.toISOString();
    }

    return { ...task, tags, platforms, cleanTitle: cleanTitle || '（タイトルなし）', due: combinedDue };
  };

  const handleAuth = () => {
    const cid = clientId.trim() || ENV_CLIENT_ID;
    if (!cid) {
      setError("Client IDがありません。.env に VITE_GOOGLE_CLIENT_ID を設定するか、入力してください。");
      return;
    }
    if (!window.google) {
      setError("Google APIのスクリプトが読み込まれていません。リロードしてください。");
      return;
    }

    localStorage.setItem('google_tasks_client_id', cid);
    setError(null);

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            setError("認証に失敗しました。以前の権限でログイン中の場合は一度切断してください。");
            return;
          }
          localStorage.setItem('google_tasks_auto_login', 'true');
          writeStoredOAuth(cid, response.access_token, response.expires_in);
          setAccessToken(response.access_token);
        },
      });
      client.requestAccessToken();
    } catch {
      setError("認証の初期化に失敗しました。");
    }
  };

  const fetchRealTasks = async (token) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let lists = [];
      let listsPageToken = '';
      do {
        const query = new URLSearchParams({
          maxResults: String(FETCH_MAX_RESULTS),
          ...(listsPageToken ? { pageToken: listsPageToken } : {}),
        });
        const listsRes = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists?${query.toString()}`, { headers });
        
        if (listsRes.status === 401 || listsRes.status === 403) {
          clearStoredOAuth();
          setAccessToken(null);
          throw new Error('セッションが期限切れか、権限がありません。もう一度ログインしてください。');
        }
        
        if (!listsRes.ok) throw new Error('タスクリストの取得に失敗しました');
        const listsData = await listsRes.json();
        lists = [...lists, ...(listsData.items || [])];
        listsPageToken = listsData.nextPageToken || '';
      } while (listsPageToken);

      let allTasks = [];
      for (const list of lists) {
        let tasksPageToken = '';
        do {
          const query = new URLSearchParams({
            showCompleted: 'true',
            showHidden: 'true',
            maxResults: String(FETCH_MAX_RESULTS),
            ...(tasksPageToken ? { pageToken: tasksPageToken } : {}),
          });
          const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?${query.toString()}`, { headers });
          
          if (tasksRes.status === 401 || tasksRes.status === 403) {
            clearStoredOAuth();
            setAccessToken(null);
            throw new Error('セッションが期限切れになりました。再ログインしてください。');
          }
          
          if (!tasksRes.ok) break;
          const tasksData = await tasksRes.json();
          if (tasksData.items) {
            const itemsWithListId = tasksData.items.map(t => ({ ...t, listId: list.id }));
            allTasks = [...allTasks, ...itemsWithListId];
          }
          tasksPageToken = tasksData.nextPageToken || '';
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

  const handleLogout = () => {
    clearStoredOAuth();
    localStorage.removeItem('google_tasks_auto_login');
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
    if (!window.confirm(`${selectedTasks.size}件のタスクを削除しますか？`)) return;
    setLoading(true);
    const tasksToDelete = tasks.filter((t) => selectedTasks.has(t.id));

    setTasks((prev) => prev.filter((t) => !selectedTasks.has(t.id)));
    setSelectedTasks(new Set());

    if (!isDemo) {
      try {
        await Promise.all(
          tasksToDelete.map((task) =>
            fetch(`https://tasks.googleapis.com/tasks/v1/lists/${task.listId}/tasks/${task.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          )
        );
      } catch {
        alert('一部のタスクの削除に失敗しました');
        fetchRealTasks(accessToken);
      }
    }
    setLoading(false);
  };

  const handleRefresh = () => {
    if (isDemo) loadDemo();
    else if (accessToken) fetchRealTasks(accessToken);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setLoading(true);
    const lines = newTaskTitle.split('\n').filter((l) => l.trim() !== '');
    const newTasks = [];

    for (const line of lines) {
      let titlePart = line.trim();
      let dueIso = newTaskDue ? new Date(newTaskDue).toISOString() : undefined;

      const commaIdx = titlePart.lastIndexOf(',');
      if (commaIdx !== -1) {
        const potentialDate = titlePart.slice(commaIdx + 1).trim();
        const d = new Date(potentialDate);
        if (!Number.isNaN(d.getTime())) {
          titlePart = titlePart.slice(0, commaIdx).trim();
          dueIso = d.toISOString();
        }
      }

      const prefix = newTaskTags.map((t) => `[${t}]`).join('');
      const fullTitle = prefix ? `${prefix} ${titlePart}` : titlePart;

      let notes = '';
      if (dueIso) {
        const d = new Date(dueIso);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        notes = `[time:${hh}:${mm}]`;
      }

      if (isDemo) {
        newTasks.push({
          id: `demo-${Date.now()}-${Math.random()}`,
          listId: 'demo',
          title: fullTitle,
          status: 'needsAction',
          due: dueIso,
          notes,
          updated: new Date().toISOString(),
        });
      } else {
        const body = { title: fullTitle, notes };
        if (dueIso) body.due = dueIso;
        try {
          const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const data = await res.json();
            newTasks.push({ ...data, listId: '@default' });
          }
        } catch {
          /* 行ごとの失敗はスキップ */
        }
      }
    }

    setTasks((prev) => [...newTasks.map(parseTask), ...prev]);
    setNewTaskTitle('');
    setNewTaskTags([]);
    setNewTaskDue('');
    setTaskFormExpanded(false);
    if (!isDemo && newTasks.length === 0 && lines.length > 0) {
      alert('タスクの追加に失敗しました');
    }
    setLoading(false);
  };

  const toggleTaskStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const now = new Date().toISOString();
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      status: newStatus,
      completed: newStatus === 'completed' ? now : null
    } : t));

    if (!isDemo) {
      try {
        await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${task.listId}/tasks/${task.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        });
      } catch {
        alert("ステータスの更新に失敗しました");
        fetchRealTasks(accessToken);
      }
    }
  };

  // === 集計 ===
  const { stats, tagStats, weeklyStats, nextWeekStats, monthStats, weeklyHistory, monthlyHistory, yearlyHistory, overallCompletionRate, analyticsTotalTasks, analyticsCompletedTasks } = useMemo(() => {
    const tagData = {};
    const total = tasks.length;
    let completed = 0;

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(now);
    const nextWeekStart = addWeeks(weekStart, 1);
    const nextWeekEnd = addWeeks(weekStart, 2);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const tasksForTopDashboard = !selectedTag
      ? tasks
      : selectedTag === '未分類'
        ? tasks.filter(t => t.tags.length === 0)
        : tasks.filter(t => t.tags.includes(selectedTag));

    let weekTotal = 0, weekCompleted = 0;
    const weekTasks = [];
    let nextWeekTotal = 0, nextWeekCompleted = 0;
    const nextWeekTasks = [];
    let monthTotal = 0, monthCompleted = 0;
    const monthTasks = [];

    let analyticsCompleted = 0;
    tasksForTopDashboard.forEach(t => {
      const isCompleted = t.status === 'completed';
      if (isCompleted) analyticsCompleted++;
      const dueDate = t.due ? new Date(t.due) : null;
      if (dueDate) {
        if (dueDate >= weekStart && dueDate < weekEnd) {
          weekTotal++;
          if (isCompleted) weekCompleted++;
          weekTasks.push(t);
        }
        if (dueDate >= nextWeekStart && dueDate < nextWeekEnd) {
          nextWeekTotal++;
          if (isCompleted) nextWeekCompleted++;
          nextWeekTasks.push(t);
        }
        if (dueDate >= monthStart && dueDate < monthEnd) {
          monthTotal++;
          if (isCompleted) monthCompleted++;
          monthTasks.push(t);
        }
      }
    });
    const analyticsTotal = tasksForTopDashboard.length;
    const overall = analyticsTotal === 0 ? 0 : Math.round((analyticsCompleted / analyticsTotal) * 100);

    const initTagData = (tag) => {
      if (!tagData[tag]) tagData[tag] = { total: 0, completed: 0 };
    };

    tasks.forEach(t => {
      const isCompleted = t.status === 'completed';
      if (isCompleted) completed++;

      const tags = t.tags.length === 0 ? ['未分類'] : t.tags;
      tags.forEach(tag => {
        initTagData(tag);
        tagData[tag].total++;
        if (isCompleted) tagData[tag].completed++;
      });
    });

    const tagStatsList = Object.entries(tagData).map(([tag, data]) => {
      const rate = data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100);
      return { tag, ...data, rate, active: data.total - data.completed };
    }).sort((a, b) => b.total - a.total);

    // 過去7週 + 今週 + 来週 = 9週分
    const history = [];
    for (let i = 7; i >= -1; i--) {
      const weekStartN = addWeeks(weekStart, -i);
      const weekEndN = addWeeks(weekStartN, 1);
      let wTotal = 0;
      let wDone = 0;
      const wTasks = [];
      tasksForTopDashboard.forEach(t => {
        if (!t.due) return;
        const d = new Date(t.due);
        if (d >= weekStartN && d < weekEndN) {
          wTotal++;
          if (t.status === 'completed') wDone++;
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
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const mEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      let mt = 0, mc = 0;
      const mTasks = [];
      tasksForTopDashboard.forEach(t => {
        if (!t.due) return;
        const d = new Date(t.due);
        if (d >= mStart && d < mEnd) {
          mt++;
          if (t.status === 'completed') mc++;
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
        tasks: mTasks,
      });
    }

    const yearlyHistory = [];
    const cy = now.getFullYear();
    for (let y = cy - 4; y <= cy; y++) {
      const yStart = new Date(y, 0, 1);
      const yEnd = new Date(y + 1, 0, 1);
      let yt = 0, yc = 0;
      const yTasks = [];
      tasksForTopDashboard.forEach(t => {
        if (!t.due) return;
        const d = new Date(t.due);
        if (d >= yStart && d < yEnd) {
          yt++;
          if (t.status === 'completed') yc++;
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
        tasks: yTasks,
      });
    }

    return {
      stats: { total, completed, active: total - completed },
      tagStats: tagStatsList,
      weeklyStats: {
        rate: weekTotal === 0 ? 0 : Math.round((weekCompleted / weekTotal) * 100),
        completed: weekCompleted,
        totalTarget: weekTotal,
        tasks: weekTasks,
      },
      nextWeekStats: {
        rate: nextWeekTotal === 0 ? 0 : Math.round((nextWeekCompleted / nextWeekTotal) * 100),
        completed: nextWeekCompleted,
        totalTarget: nextWeekTotal,
        tasks: nextWeekTasks,
      },
      monthStats: {
        rate: monthTotal === 0 ? 0 : Math.round((monthCompleted / monthTotal) * 100),
        completed: monthCompleted,
        totalTarget: monthTotal,
        tasks: monthTasks,
      },
      weeklyHistory: history,
      monthlyHistory,
      yearlyHistory,
      overallCompletionRate: overall,
      analyticsTotalTasks: analyticsTotal,
      analyticsCompletedTasks: analyticsCompleted,
    };
  }, [tasks, selectedTag]);

  const routineGroups = useMemo(() => {
    let filteredForRoutine = tasks;
    // タグ絞り込みのみ適用し、検索クエリ(searchQuery)はここでは除外
    if (selectedTag) {
      filteredForRoutine = selectedTag === '未分類' ? tasks.filter(t => t.tags.length === 0) : tasks.filter(t => t.tags.includes(selectedTag));
    }

    const wordCounts = {};
    filteredForRoutine.forEach((t) => {
      const words = t.cleanTitle.split(/[\s,，、・\-()（）[\]［］{}｛｝]+/);
      words.forEach((w) => {
        if (w.length < 2 || /^[0-9０-９]+$/.test(w)) return;
        if (/課題[0-9０-９]+/.test(w) || /[0-9０-９]+回/.test(w)) return;
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      });
    });

    const threshold = 3;
    const routineKeywords = Object.keys(wordCounts).filter(w => wordCounts[w] >= threshold);

    const tempGroups = {};
    filteredForRoutine.forEach((t) => {
      const words = t.cleanTitle.split(/[\s,，、・\-()（）[\]［］{}｛｝]+/);
      const taskKeywords = [...new Set(words.filter(w => routineKeywords.includes(w)))];

      taskKeywords.forEach((kw) => {
        if (!tempGroups[kw]) {
          tempGroups[kw] = { title: [kw], count: 0, completedCount: 0, tasks: [], taskIds: new Set() };
        }
        tempGroups[kw].count += 1;
        tempGroups[kw].tasks.push(t);
        tempGroups[kw].taskIds.add(t.id);
        if (t.status === 'completed') tempGroups[kw].completedCount += 1;
      });
    });

    // まったく一緒のタスク群を持つワードを統合する
    const mergedGroups = [];
    Object.values(tempGroups).forEach(group => {
      if (group.count < threshold) return;
      const existing = mergedGroups.find(mg => 
        mg.taskIds.size === group.taskIds.size && 
        [...mg.taskIds].every(id => group.taskIds.has(id))
      );
      if (existing) {
        existing.title.push(...group.title);
      } else {
        mergedGroups.push(group);
      }
    });

    return mergedGroups
      .map(g => ({
        ...g,
        titleLabel: g.title.join(' / '),
        activeCount: g.count - g.completedCount
      }))
      // 未達成のタスク数順（降順）
      .sort((a, b) => b.activeCount - a.activeCount || b.count - a.count);
  }, [tasks, selectedTag]);

  // === フィルター & ソート ===
  const { activeGroups, activeTotalCount, historyList } = useMemo(() => {
    let filtered = tasks;
    if (selectedTag) {
      filtered = selectedTag === '未分類'
        ? tasks.filter(t => t.tags.length === 0)
        : tasks.filter(t => t.tags.includes(selectedTag));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          (t.cleanTitle && t.cleanTitle.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    if (selectedRoutine) {
      const rg = routineGroups.find(g => g.titleLabel === selectedRoutine);
      if (rg) {
        filtered = filtered.filter(t => rg.taskIds.has(t.id));
      }
    }

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(now);

    let active = filtered.filter(t => t.status === 'needsAction');
    if (showOnlyNoDue) {
      active = active.filter(t => !t.due);
      const sorted = [...active].sort((a, b) => (a.cleanTitle || '').localeCompare(b.cleanTitle || '', 'ja'));
      const groups = sorted.length
        ? [{ bucket: 5, title: ACTIVE_SECTION_TITLES[5], tasks: sorted }]
        : [];
      const history = filtered
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.completed || 0) - new Date(a.completed || 0));
      return {
        activeGroups: groups,
        activeTotalCount: sorted.length,
        historyList: history,
      };
    }

    const buckets = ACTIVE_SECTION_TITLES.map((title, bucket) => {
      let groupTitle = title;
      if (bucket === 1) {
        groupTitle = `今日 (${now.getMonth() + 1}/${now.getDate()}(${WEEKDAYS[now.getDay()]}))`;
      } else if (bucket === 2) {
        const tmr = new Date(now);
        tmr.setDate(tmr.getDate() + 1);
        groupTitle = `明日 (${tmr.getMonth() + 1}/${tmr.getDate()}(${WEEKDAYS[tmr.getDay()]}))`;
      }
      return { bucket, title: groupTitle, tasks: [] };
    });

    active.forEach(task => {
      const { bucket } = getActiveSortKey(task, now, weekStart, weekEnd);
      buckets[bucket].tasks.push(task);
    });
    buckets.forEach(b => {
      b.tasks.sort((a, c) => {
        const ka = getActiveSortKey(a, now, weekStart, weekEnd);
        const kc = getActiveSortKey(c, now, weekStart, weekEnd);
        return ka.dueMs - kc.dueMs;
      });
    });
    const activeGroups = buckets.filter(b => b.tasks.length > 0);
    const activeTotalCount = activeGroups.reduce((n, g) => n + g.tasks.length, 0);

    const history = filtered
      .filter(t => t.status === 'completed')
      .sort((a, b) => new Date(b.completed || 0) - new Date(a.completed || 0));

    return { activeGroups, activeTotalCount, historyList: history };
  }, [tasks, selectedTag, showOnlyNoDue, searchQuery, selectedRoutine, routineGroups]);

  const tagAndSearchTaskCount = useMemo(() => {
    let f = tasks;
    if (selectedTag) {
      f = selectedTag === '未分類' ? tasks.filter((t) => t.tags.length === 0) : tasks.filter((t) => t.tags.includes(selectedTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(
        (t) =>
          (t.cleanTitle && t.cleanTitle.toLowerCase().includes(q)) || t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return f.length;
  }, [tasks, selectedTag, searchQuery]);

  const leadTimeStats = useMemo(() => {
    let early = 0; let onTime = 0; let late = 0; let totalDiff = 0; let count = 0;
    tasks.forEach(t => {
      if (t.status === 'completed' && t.completed && t.due) {
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
      lateTasks: late
    };
  }, [tasks]);

  const calendarTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedTag) {
      filtered = selectedTag === '未分類'
        ? tasks.filter(t => t.tags.length === 0)
        : tasks.filter(t => t.tags.includes(selectedTag));
    }
    return filtered;
  }, [tasks, selectedTag]);

  const flatNavTasks = useMemo(() => {
    if (activeTab === 'active') return activeGroups.flatMap((g) => g.tasks);
    if (activeTab === 'history') return historyList;
    return [];
  }, [activeTab, activeGroups, historyList]);

  const isTypingInField = () => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable;
  };

  useEffect(() => {
    if (periodModalTiltDeg === 0) return undefined;
    const t = setTimeout(() => setPeriodModalTiltDeg(0), 380);
    return () => clearTimeout(t);
  }, [periodModalPeriod, periodModalTiltDeg]);

  useEffect(() => {
    if (!keyboardFocusedTaskId) return;
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = document.querySelector(`[data-task-row-id="${esc(keyboardFocusedTaskId)}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [keyboardFocusedTaskId, flatNavTasks]);

  useEffect(() => {
    setKeyboardFocusedTaskId((prev) => {
      if (!prev) return null;
      if (flatNavTasks.some((t) => t.id === prev)) return prev;
      return null;
    });
  }, [flatNavTasks]);

  useEffect(() => {
    if (activeTab !== 'active' && activeTab !== 'history') {
      setKeyboardFocusedTaskId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Shift') {
        setShiftHeld(true);
        return;
      }

      if (!accessToken && !isDemo) return;

      if (isTypingInField()) return;

      if (periodModalPeriod) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPeriodModalPeriod(null);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const i = PERIOD_MODAL_ORDER.indexOf(periodModalPeriod);
          setPeriodModalTiltDeg(-14);
          setPeriodModalPeriod(PERIOD_MODAL_ORDER[(i - 1 + 3) % 3]);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const i = PERIOD_MODAL_ORDER.indexOf(periodModalPeriod);
          setPeriodModalTiltDeg(14);
          setPeriodModalPeriod(PERIOD_MODAL_ORDER[(i + 1) % 3]);
          return;
        }
      }

      if (e.key === 'Escape') {
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

      if (activeTab !== 'active' && activeTab !== 'history') return;
      if (loading) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (flatNavTasks.length === 0) return;
        setKeyboardFocusedTaskId((prev) => {
          if (!prev) return flatNavTasks[0].id;
          const i = flatNavTasks.findIndex((t) => t.id === prev);
          const next = i < 0 ? 0 : Math.min(i + 1, flatNavTasks.length - 1);
          return flatNavTasks[next].id;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (flatNavTasks.length === 0) return;
        setKeyboardFocusedTaskId((prev) => {
          if (!prev) return flatNavTasks[0].id;
          const i = flatNavTasks.findIndex((t) => t.id === prev);
          const next = i < 0 ? 0 : Math.max(i - 1, 0);
          return flatNavTasks[next].id;
        });
        return;
      }

      if (e.key === 'Enter') {
        const id = keyboardFocusedTaskId;
        if (!id) return;
        const task = flatNavTasks.find((t) => t.id === id);
        if (task) {
          e.preventDefault();
          toggleTaskStatus(task);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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


  const getTagColor = (tag) => {
    const s = String(tag || '');
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200', 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-purple-100 text-purple-800 border-purple-200', 'bg-amber-100 text-amber-800 border-amber-200',
      'bg-rose-100 text-rose-800 border-rose-200', 'bg-indigo-100 text-indigo-800 border-indigo-200',
    ];
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (!accessToken && !isDemo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-slate-800 p-6 text-center">
            <LayoutDashboard className="mx-auto text-white mb-3" size={40} />
            <h1 className="text-2xl font-bold text-white">Task Dashboard</h1>
            <p className="text-slate-300 text-sm mt-1">タグ分類＆達成率分析付き ToDo</p>
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
                className={`w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
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
                {clientIdOverrideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Client ID の設定
              </button>

              {clientIdOverrideOpen && (
                <div className="mt-3 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Google Cloud Console で作成した「Web アプリケーション」の Client ID を入力してください。
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
                        localStorage.setItem('google_tasks_client_id', clientId);
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

  const isDark = ['dark', 'navy', 'pitchBlack'].includes(uiConfig.bgTheme);
  const animDur = uiConfig.animation === 'off' ? '0s' : '0.3s';
  const animDurBg = uiConfig.animation === 'off' ? '0s' : '0.5s';
  
  let panelBg = tColors.panel;
  let panelBlur = '0px';
  let panelShadow = isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)';
  let panelBorder = `1px solid ${tColors.border}`;
  
  if (uiConfig.texture === 'glass') {
    panelBg = isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.5)';
    panelBlur = '24px';
    panelShadow = isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.06)';
    panelBorder = isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.5)';
  } else if (uiConfig.texture === 'simple') {
    panelShadow = 'none';
    panelBorder = `1px solid ${tColors.border}`;
  } else if (uiConfig.texture === 'neon') {
    panelBorder = `1px solid ${uiColors.dark}`;
    panelShadow = `0 0 15px ${uiColors.main}60, inset 0 0 8px ${uiColors.main}30`;
  }

  const appBgColor = uiConfig.texture === 'glass' 
    ? `linear-gradient(135deg, ${tColors.bg} 0%, ${isDark ? '#000000' : uiColors.light} 100%)` 
    : tColors.bg;

  return (
    <div className="min-h-screen pb-12 w-full flex flex-col" style={{ fontFamily: fontMap[uiConfig.font], background: appBgColor, color: tColors.text, fontWeight: currentWeight.base, transition: `background-color ${animDurBg}, color ${animDurBg}` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=JetBrains+Mono:wght@400;700&family=M+PLUS+Rounded+1c:wght@400;700;900&family=Noto+Sans+JP:wght@300;400;500;700;900&family=Noto+Serif+JP:wght@300;400;700;900&family=Shippori+Mincho+B1:wght@400;500;700;800&family=Zen+Kaku+Gothic+Antique:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Zen+Old+Mincho:wght@400;700;900&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@line/seed-sans-jp@1.0.0/dist/line-seed-sans-jp.css');

        :root {
          --ui-accent: ${uiColors.main};
          --ui-accent-dark: ${uiColors.dark};
          --ui-accent-light: ${isDark ? uiColors.dark + '40' : uiColors.light};
          --ui-accent-border: ${isDark ? uiColors.main + '80' : uiColors.border};
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
          --ui-icon-weight: ${uiConfig.iconWeight === 'light' ? '1.25' : uiConfig.iconWeight === 'bold' ? '2.75' : '2'};
          --ui-density-gap: ${densityValues[uiConfig.density].gap};
          --ui-density-p: ${densityValues[uiConfig.density].p};
          
          /* セマンティックカラー */
          --ui-danger: ${isDark ? '#f87171' : '#ef4444'};
          --ui-danger-bg: ${isDark ? '#450a0a' : '#fef2f2'};
          --ui-success: ${isDark ? '#34d399' : '#10b981'};
          --ui-warning: ${isDark ? '#fbbf24' : '#f59e0b'};
        }

        * {
          transition-duration: var(--ui-transition) !important;
          transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        }

        /* アイコン太さ一括制御 */
        svg.lucide { stroke-width: var(--ui-icon-weight) !important; }

        /* ウェイトの徹底オーバーライド */
        .font-normal { font-weight: var(--ui-weight-base) !important; }
        .font-medium { font-weight: var(--ui-weight-medium) !important; }
        .font-bold, .font-semibold { font-weight: var(--ui-weight-bold) !important; }
        .font-black { font-weight: var(--ui-weight-black) !important; }
        
        /* 質感 (Texture) の強制適用 */
        .bg-white, .bg-slate-50, .bg-slate-100, .bg-slate-800 {
          background: ${panelBg} !important;
          backdrop-filter: blur(${panelBlur}) !important;
          -webkit-backdrop-filter: blur(${panelBlur}) !important;
          box-shadow: ${panelShadow} !important;
          border: ${panelBorder} !important;
          color: var(--ui-text) !important;
        }

        input, textarea { 
          background-color: ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)'} !important; 
          color: var(--ui-text) !important;
          border-color: ${tColors.border} !important;
        }

        /* 達成率などのグラデーションカード */
        .ui-gradient-card {
          background: linear-gradient(135deg, var(--ui-accent) 0%, var(--ui-accent-dark) 100%) !important;
          color: var(--ui-accent-contrast) !important;
          border: none !important;
        }
        .ui-gradient-card p, .ui-gradient-card span, .ui-gradient-card div { color: var(--ui-accent-contrast) !important; opacity: 0.95; }
        .ui-gradient-card svg { color: var(--ui-accent-contrast) !important; opacity: 0.5; }

        /* FABボタン */
        .ui-fab {
          background-color: var(--ui-accent) !important;
          color: var(--ui-accent-contrast) !important;
          box-shadow: 0 10px 25px -5px var(--ui-accent-border), 0 8px 10px -6px var(--ui-accent-border) !important;
          border: none !important;
        }

        /* Paper(ノイズ)テクスチャオーバーレイ */
        ${uiConfig.texture === 'paper' ? `
        body::before {
          content: ""; position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          opacity: ${isDark ? 0.05 : 0.08}; pointer-events: none; z-index: 9999;
        }` : ''}

        /* Neon 質感 */
        ${uiConfig.texture === 'neon' ? `
        .ui-highlight-bg { box-shadow: 0 0 10px var(--ui-accent), 0 0 20px var(--ui-accent) !important; }
        button:hover { text-shadow: 0 0 8px currentColor; }
        ` : ''}

        /* Liquid 質感 */
        ${uiConfig.texture === 'liquid' ? `
        @keyframes liquidBorder {
          0% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
          33% { border-radius: 60% 40% 50% 50% / 40% 60% 50% 50%; }
          66% { border-radius: 40% 60% 50% 50% / 60% 40% 50% 50%; }
          100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
        }
        button, .rounded-xl { transition: border-radius var(--ui-transition) ease; }
        button:hover, .ui-highlight-bg { animation: liquidBorder 2s infinite linear; }
        ` : ''}

        /* 密度 (Density) の安全な適用 (特定要素のみをターゲットにして崩れを防ぐ) */
        .ui-panel { padding: var(--ui-density-p) !important; }
        .ui-layout-gap { gap: var(--ui-density-gap) !important; }
        
        .rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl { border-radius: var(--ui-radius) !important; }

        /* スクロールバー */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background-color: ${isDark ? '#334155' : 'var(--ui-accent-border)'};
          border-radius: var(--ui-radius);
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover { background-color: var(--ui-accent); }

        /* 全使用色の上書き */
        .ui-highlight-bg { background-color: var(--ui-text) !important; opacity: 0.08 !important; border:none !important; }
        
        .bg-blue-600, .bg-indigo-600 { background-color: var(--ui-accent) !important; color: var(--ui-accent-contrast) !important; border:none !important;}
        .hover\\:bg-blue-700:hover { background-color: var(--ui-accent-dark) !important; }
        .bg-blue-50, .bg-indigo-50 { background-color: var(--ui-accent-light) !important; border-color: var(--ui-accent-border) !important;}
        
        .text-blue-500, .text-blue-600, .text-indigo-600, .text-violet-600 { color: var(--ui-accent) !important; }
        .text-slate-800, .text-slate-700 { color: var(--ui-text) !important; }
        .text-slate-600, .text-slate-500, .text-slate-400 { color: var(--ui-text-muted) !important; }
        
        .border-blue-100, .border-blue-200, .border-indigo-200, .border-slate-200, .border-slate-100 { border-color: ${panelBorder.split(' ')[2]} !important; }
        .ring-blue-500 { --tw-ring-color: var(--ui-accent) !important; }

        /* ステータスカラーの書き換え */
        .text-red-400, .text-red-500, .text-red-600, .text-red-700 { color: var(--ui-danger) !important; }
        .bg-red-50, .bg-red-100, .bg-red-200 { background-color: var(--ui-danger-bg) !important; border-color: var(--ui-danger) !important; opacity: 0.8;}
        .text-emerald-400, .text-emerald-500, .text-emerald-600 { color: var(--ui-success) !important; }
        .text-amber-400, .text-amber-500, .text-amber-600, .text-amber-700 { color: var(--ui-warning) !important; }
      `}</style>
      <header className="border-b sticky top-0 z-30" style={{ background: panelBg, backdropFilter: `blur(${panelBlur})` }}>
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 xl:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <LayoutDashboard className="text-blue-600" size={24} />
            <h1 className="font-bold text-lg hidden sm:block">Task Dashboard</h1>
            {isDemo && <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">DEMO</span>}
          </div>

          {((accessToken && !error) || isDemo) && (
            <div className="flex-1 min-w-0 max-w-md relative flex items-center">
              <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 sm:pl-9 pr-2 sm:pr-4 py-1.5 sm:py-2 bg-slate-100/80 border border-transparent rounded-lg text-xs sm:text-sm focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-50"
              title="更新"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut size={16} /> 切断
            </button>
          </div>

          <button
            type="button"
            className="xl:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition relative w-10 h-10 flex flex-col justify-center items-center gap-1.5"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label="メニュー"
          >
            <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-100 bg-slate-50 px-4 py-4 flex flex-col gap-4 animate-in slide-in-from-top-2 shadow-inner">
            {routineGroups.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Layers size={12} /> ルーチン絞り込み</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setSelectedRoutine(null)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${selectedRoutine === null ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                    すべて
                  </button>
                  {routineGroups.slice(0, 10).map(g => (
                    <button key={`mob-r-${g.titleLabel}`} type="button"
                      onClick={() => setSelectedRoutine(prev => prev === g.titleLabel ? null : g.titleLabel)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${selectedRoutine === g.titleLabel ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {g.titleLabel} ({g.activeCount})
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setActiveTab('active'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <Circle size={14} className="inline mr-1" />} {t('active', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('history'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <History size={14} className="inline mr-1" />} {t('history', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'calendar' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <Calendar size={14} className="inline mr-1" />} {t('calendar', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('analytics'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <BarChart3 size={14} className="inline mr-1" />} {t('analytics', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('routines'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'routines' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <Layers size={14} className="inline mr-1" />} {t('routines', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('tags'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'tags' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <Tag size={14} className="inline mr-1" />} {t('tags', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('replace'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'replace' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <RefreshCw size={14} className="inline mr-1" />} {t('replace', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'settings' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                {uiConfig.iconStyle !== 'text' && <Settings size={14} className="inline mr-1" />} {t('settings', uiConfig.language)}
              </button>
            </div>
            <div className="flex gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => { handleRefresh(); setIsMobileMenuOpen(false); }} className="flex-1 flex justify-center items-center gap-2 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('refresh', uiConfig.language)}
              </button>
              <button type="button" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="flex-1 flex justify-center items-center gap-2 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-red-600">
                <LogOut size={16} /> {t('logout', uiConfig.language)}
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 xl:px-8 pt-6 xl:pt-8 flex flex-col lg:flex-row ui-layout-gap items-start w-full">
        <aside
          className="hidden xl:flex flex-col w-[260px] 2xl:w-[300px] shrink-0 ui-layout-gap sticky top-[88px] h-[calc(100vh-88px)] overflow-y-auto hide-scrollbar pb-10"
        >
          {/* メインメニュー */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 ui-panel">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
              {uiConfig.iconStyle !== 'text' && <LayoutDashboard size={16} />} Menu
            </h2>
            <nav className="flex flex-col gap-2" aria-label="メインメニュー">
              {[
                { value: 'active', icon: Circle, textIcon: 'ACT', label: t('active', uiConfig.language) },
                { value: 'history', icon: History, textIcon: 'HIS', label: t('history', uiConfig.language) },
                { value: 'calendar', icon: Calendar, textIcon: 'CAL', label: t('calendar', uiConfig.language) },
                { value: 'analytics', icon: BarChart3, textIcon: 'ANA', label: t('analytics', uiConfig.language) },
                { value: 'routines', icon: Layers, textIcon: 'RTN', label: t('routines', uiConfig.language) },
                { value: 'tags', icon: Tag, textIcon: 'TAG', label: t('tags', uiConfig.language) },
                { value: 'replace', icon: RefreshCw, textIcon: 'RPL', label: t('replace', uiConfig.language) },
                { value: 'settings', icon: Settings, textIcon: 'SET', label: t('settings', uiConfig.language) },
              ].map(({ value, label, textIcon, icon: Icon }) => {
                const isActive = activeTab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value)}
                    className={`px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                      isActive
                        ? 'text-[var(--ui-accent)] font-bold bg-slate-500/10'
                        : 'text-[var(--ui-text-muted)] hover:bg-slate-500/5'
                    }`}
                  >
                    {uiConfig.iconStyle === 'text' ? <span className="font-mono font-bold text-xs">[{textIcon}]</span> : <Icon size={16} />}
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* タグによる絞り込み */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 ui-panel">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
              {uiConfig.iconStyle !== 'text' && <Tag size={16} />} Tags
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${
                  selectedTag === null ? 'text-[var(--ui-accent)] font-bold bg-slate-500/10' : 'text-[var(--ui-text-muted)] hover:bg-slate-500/5'
                }`}
              >
                {t('all', uiConfig.language)} ({stats.total})
              </button>
              {tagStats.map((tagData) => (
                <button
                  key={tagData.tag}
                  type="button"
                  onClick={() => setSelectedTag(prev => prev === tagData.tag ? null : tagData.tag)}
                  className={`px-3 py-2 rounded-lg text-sm transition relative overflow-hidden flex flex-col group ${
                    selectedTag === tagData.tag ? 'text-[var(--ui-accent)] font-bold bg-slate-500/10' : 'text-[var(--ui-text-muted)] hover:bg-slate-500/5'
                  }`}
                >
                  <div className="flex justify-between items-center w-full relative z-10">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${tagData.tag === '未分類' ? 'bg-slate-300' : getTagColor(tagData.tag).split(' ')[0]}`} />
                      <span className="text-sm font-medium truncate">{tagData.tag}</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0 text-slate-600">
                      {tagData.active > 0 ? tagData.active : '✓'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/70 rounded-full h-1 mt-1.5 relative z-10 overflow-hidden">
                    <div className={`h-1 rounded-full ${tagData.rate === 100 ? 'bg-emerald-400' : 'bg-[var(--ui-accent)] opacity-50'}`} style={{ width: `${tagData.rate}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ルーチン絞り込み */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 ui-panel">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
              {uiConfig.iconStyle !== 'text' && <Layers size={16} />} Routines
            </h2>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 hide-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedRoutine(null)}
                className={`px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${
                  selectedRoutine === null ? 'text-[var(--ui-accent)] font-bold bg-slate-500/10' : 'text-[var(--ui-text-muted)] hover:bg-slate-500/5'
                }`}
              >
                {t('all', uiConfig.language)}
              </button>
              {routineGroups.slice(0, 15).map((g) => (
                <button
                  key={`side-routine-${g.titleLabel}`}
                  type="button"
                  onClick={() => setSelectedRoutine(prev => prev === g.titleLabel ? null : g.titleLabel)}
                  className={`px-3 py-2 rounded-lg text-sm transition flex justify-between items-center ${
                    selectedRoutine === g.titleLabel ? 'text-[var(--ui-accent)] font-bold bg-slate-500/10' : 'text-[var(--ui-text-muted)] hover:bg-slate-500/5'
                  }`}
                  title={g.titleLabel}
                >
                  <span className="truncate relative z-10">{g.titleLabel}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full shrink-0 relative z-10">{g.activeCount > 0 ? g.activeCount : '✓'}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col ui-layout-gap pb-12 w-full">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-2 w-full">
            <div className="col-span-2 lg:col-span-1 ui-gradient-card ui-panel rounded-xl relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="relative z-10 text-white">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5">
                  {uiConfig.iconStyle !== 'text' && <TrendingUp size={16} />} {t('weeklyProgress', uiConfig.language)}
                </p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black">{weeklyStats.rate}</span>
                  <span className="text-lg font-bold">%</span>
                </div>
                <p className="text-xs mt-2 font-medium opacity-80">
                  {weeklyStats.totalTarget === 0 ? '-' : `${t('completed', uiConfig.language)} ${weeklyStats.completed} / ${t('total', uiConfig.language)} ${weeklyStats.totalTarget}`}
                </p>
              </div>
              {uiConfig.widgetDecor === 'target' && <Target className="absolute -right-4 -bottom-4 opacity-10 text-white" size={100} />}
              {uiConfig.widgetDecor === 'sparkle' && <span className="absolute right-2 bottom-2 text-5xl opacity-20">✨</span>}
              {uiConfig.widgetDecor === 'neon' && <div className="absolute right-0 bottom-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-20 mix-blend-overlay" />}
            </div>
            <div className="col-span-1">
              <PeriodCard
                label={t('thisWeek', uiConfig.language)}
                icon={uiConfig.iconStyle !== 'text' && <Calendar size={14} />}
                stats={weeklyStats}
                accent="text-[var(--ui-accent)]"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod('week'); }}
              />
            </div>
            <div className="col-span-1">
              <PeriodCard
                label={t('thisWeek', uiConfig.language)}
                icon={uiConfig.iconStyle !== 'text' && <Calendar size={14} />}
                stats={nextWeekStats}
                accent="text-[var(--ui-accent-dark)]"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod('nextWeek'); }}
              />
            </div>
            <div className="col-span-2 lg:col-span-1">
              <PeriodCard
                label={t('thisMonth', uiConfig.language)}
                icon={uiConfig.iconStyle !== 'text' && <Calendar size={14} />}
                stats={monthStats}
                accent="text-[var(--ui-accent-dark)] opacity-70"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod('month'); }}
              />
            </div>
          </div>

          {/* === モバイル用 Tags 横並び（達成率・件数付き） */}
          {activeTab === 'active' && (
            <>
              {taskFormExpanded ? (
                <form onSubmit={handleAddTask} className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                       <Plus size={18} className="text-blue-500" /> {t('addLabel', uiConfig.language) || 'New Task'}
                    </span>
                    <button type="button" onClick={() => setTaskFormExpanded(false)} className="p-1 px-2 text-xs font-bold text-slate-400 hover:bg-slate-100 rounded-lg transition" >
                      {t('closeLabel', uiConfig.language) || 'Close'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <textarea placeholder={t('titlePlaceholder', uiConfig.language) || 'Enter title...'} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} rows={3}
                      className="w-full py-2 px-3 outline-none text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white resize-y text-sm" />
                    <div className="flex justify-end">
                      <button type="submit" disabled={!newTaskTitle.trim() || loading} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 shadow-sm" >
                        {t('add', uiConfig.language) || 'Add'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView tasks={tasks} weeklyHistory={weeklyHistory} monthlyHistory={monthlyHistory} yearlyHistory={yearlyHistory} overallCompletionRate={overallCompletionRate} totalTasks={analyticsTotalTasks} completedTasks={analyticsCompletedTasks} tagStats={tagStats} selectedTag={selectedTag} toggleTaskStatus={toggleTaskStatus} {...leadTimeStats} />
          )}
          {activeTab === 'calendar' && (
            <CalendarView tasks={calendarTasks} mode={calendarMode} setMode={setCalendarMode} cursor={calendarCursor} setCursor={setCalendarCursor} toggleTaskStatus={toggleTaskStatus} getTagColor={getTagColor} />
          )}
          {activeTab === 'routines' && (
            <RoutineDetectorView routineGroups={routineGroups} selectedRoutine={selectedRoutine} toggleTaskStatus={toggleTaskStatus} selectedTasks={selectedTasks} toggleSelection={toggleSelection} setSelectedTasks={setSelectedTasks} handleDeleteSelected={handleDeleteSelected} showCheckboxes={showCheckboxes} selectionMode={selectionMode} setSelectionMode={setSelectionMode} showCompleted={routineShowCompleted} setShowCompleted={setRoutineShowCompleted} />
          )}
          {activeTab === 'tags' && (
            <TagManagerView tagStats={tagStats} tasks={tasks} toggleTaskStatus={toggleTaskStatus} getTagColor={getTagColor} selectedTasks={selectedTasks} toggleSelection={toggleSelection} setSelectedTasks={setSelectedTasks} handleDeleteSelected={handleDeleteSelected} showCheckboxes={showCheckboxes} selectionMode={selectionMode} setSelectionMode={setSelectionMode} showCompleted={tagShowCompleted} setShowCompleted={setTagShowCompleted} />
          )}
          {activeTab === 'replace' && (
            <BatchReplaceView tasks={tasks} accessToken={accessToken} fetchRealTasks={fetchRealTasks} isDemo={isDemo} />
          )}
          {activeTab === 'settings' && (
            <UISettingsView uiConfig={uiConfig} setUiConfig={setUiConfig} />
          )}

          {(activeTab === 'active' || activeTab === 'history') && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-3 py-1 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode((prev) => {
                      if (prev) setSelectedTasks(new Set());
                      return !prev;
                    });
                  }}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition border shrink-0 ${selectionMode
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {selectionMode ? '選択終了' : '選択モード'}
                </button>
                <span className="text-[9px] text-slate-400 text-right leading-tight flex-1 min-w-0 sm:max-w-[65%]">
                  1–9タグ · Escすべて · ↑↓ · Enter完了 · Shift/行クリック複数 · ポップアップ←→
                </span>
              </div>
              <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 min-w-0">
                  {selectedTag ? (
                    <><span className="text-slate-400 shrink-0">#</span> <span className="truncate">{selectedTag}</span></>
                  ) : (activeTab === 'active'
                    ? (showOnlyNoDue ? '期限なしのアクティブタスク' : 'アクティブタスク（時系列・見出し別）')
                    : 'すべての完了履歴')}
                </h2>
                <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm shrink-0 tabular-nums">
                  {activeTab === 'active' ? activeTotalCount : historyList.length} 件
                </span>
              </div>

              {selectedTasks.size > 0 && (
                <div className="bg-slate-800 text-white px-4 py-3 shadow-lg flex items-center justify-between sticky top-[108px] z-[25] animate-in fade-in slide-in-from-top-2 border-b border-slate-700">
                  <span className="text-sm font-medium">{selectedTasks.size} 件を選択中</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedTasks(new Set())} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-lg transition">キャンセル</button>
                    <button type="button" onClick={handleDeleteSelected} className="px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm">
                      <Trash2 size={14} /> 削除
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                  <RefreshCw className="animate-spin mb-3" size={28} />
                  <p>読み込み中...</p>
                </div>
              ) : (activeTab === 'active' ? activeTotalCount === 0 : historyList.length === 0) ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle2 size={40} className="mx-auto mb-3 opacity-20" />
                  <p>{activeTab === 'active'
                    ? (showOnlyNoDue ? '期限なしのタスクはありません' : 'タスクはすべて完了しました！🎉')
                    : '完了したタスクはありません'}</p>
                </div>
              ) : activeTab === 'active' ? (
                <div>
                  {activeGroups.map(group => (
                    <section key={group.bucket} className="border-b border-slate-100 last:border-b-0">
                      <div className="sticky top-16 z-[5] px-4 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-baseline justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-800">{group.title}</h3>
                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">{group.tasks.length} 件</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.tasks.map(task => {
                          const overdue = task.status !== 'completed' && isOverdue(task.due);
                          const isKbFocus = keyboardFocusedTaskId === task.id;
                          const isMultiSel = showCheckboxes && selectedTasks.has(task.id);
                          return (
                            <div
                              key={task.id}
                              data-task-row-id={task.id}
                              onClick={() => { if (showCheckboxes) toggleSelection(task.id); }}
                              className={`p-4 flex items-start gap-3 transition group ${isKbFocus ? 'ring-2 ring-inset ring-blue-500 z-[1]' : ''
                                } ${isMultiSel
                                  ? overdue
                                    ? 'bg-red-200/70 hover:bg-red-200/85 border-l-4 border-red-500'
                                    : 'bg-slate-300/80 hover:bg-slate-300'
                                  : overdue
                                    ? 'bg-red-50/40 hover:bg-red-50 border-l-4 border-red-400'
                                    : 'hover:bg-slate-50'
                                } ${showCheckboxes ? 'cursor-pointer' : ''}`}
                            >
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                                className="mt-1 p-0.5 -ml-0.5 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                              >
                                {task.status === 'completed' ? (
                                  <CheckCircle2 className="text-emerald-500 hover:text-emerald-600 transition" size={22} />
                                ) : (
                                  <Circle className={`${overdue ? 'text-red-400 group-hover:text-red-500' : 'text-slate-300 group-hover:text-blue-500'} transition`} size={22} />
                                )}
                              </button>
                              <div className="flex-grow min-w-0">
                                <h3 className={`font-medium text-base mb-1.5 whitespace-normal break-words ${overdue ? 'text-red-700' : 'text-slate-800'}`}>
                                  {task.cleanTitle}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2">
                                  {(task.platforms || []).map(p => (
                                    <span
                                      key={p}
                                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getLmsBadgeClass(p)}`}
                                    >
                                      {p}
                                    </span>
                                  ))}
                                  {task.tags.map(tag => (
                                    <span
                                      key={tag}
                                      onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); }}
                                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition ${getTagColor(tag)}`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {task.due && (
                                    <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${overdue
                                      ? 'text-red-700 bg-red-100 border-red-300 animate-pulse'
                                      : 'text-amber-700 bg-amber-50 border-amber-200'
                                      }`}>
                                      {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
                                      {overdue ? '期限超過: ' : '期限: '}{formatDue(task.due)}
                                    </div>
                                  )}
                                  {!task.due && (
                                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                                      <CalendarOff size={11} /> 期限なし
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
                <div className="divide-y divide-slate-100">
                  {historyList.map(task => {
                    const overdue = task.status !== 'completed' && isOverdue(task.due);
                    const isKbFocus = keyboardFocusedTaskId === task.id;
                    const isMultiSel = showCheckboxes && selectedTasks.has(task.id);
                    return (
                      <div
                        key={task.id}
                        data-task-row-id={task.id}
                        onClick={() => { if (showCheckboxes) toggleSelection(task.id); }}
                        className={`p-4 flex items-start gap-3 transition group ${isKbFocus ? 'ring-2 ring-inset ring-blue-500 z-[1]' : ''
                          } ${isMultiSel
                            ? task.status === 'completed'
                              ? 'bg-slate-300/70 opacity-90'
                              : overdue
                                ? 'bg-red-200/70 border-l-4 border-red-500'
                                : 'bg-slate-300/80'
                            : task.status === 'completed'
                              ? 'opacity-70 bg-slate-50/50 hover:bg-slate-50'
                              : overdue
                                ? 'bg-red-50/40 hover:bg-red-50 border-l-4 border-red-400'
                                : 'hover:bg-slate-50'
                          } ${showCheckboxes ? 'cursor-pointer' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                          className="mt-1 p-0.5 -ml-0.5 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="text-emerald-500 hover:text-emerald-600 transition" size={22} />
                          ) : (
                            <Circle className={`${overdue ? 'text-red-400 group-hover:text-red-500' : 'text-slate-300 group-hover:text-blue-500'} transition`} size={22} />
                          )}
                        </button>

                        <div className="flex-grow min-w-0">
                          <h3 className={`font-medium text-base mb-1.5 whitespace-normal break-words ${task.status === 'completed'
                            ? 'line-through text-slate-500'
                            : overdue ? 'text-red-700' : 'text-slate-800'
                            }`}>
                            {task.cleanTitle}
                          </h3>

                          <div className="flex flex-wrap items-center gap-2">
                            {(task.platforms || []).map(p => (
                              <span
                                key={p}
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getLmsBadgeClass(p)}`}
                              >
                                {p}
                              </span>
                            ))}
                            {task.tags.map(tag => (
                              <span
                                key={tag}
                                onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); }}
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition ${getTagColor(tag)}`}
                              >
                                {tag}
                              </span>
                            ))}

                            {task.due && task.status !== 'completed' && (
                              <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${overdue
                                ? 'text-red-700 bg-red-100 border-red-300 animate-pulse'
                                : 'text-amber-700 bg-amber-50 border-amber-200'
                                }`}>
                                {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
                                {overdue ? '期限超過: ' : '期限: '}{formatDue(task.due)}
                              </div>
                            )}

                            {!task.due && task.status !== 'completed' && (
                              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                                <CalendarOff size={11} /> 期限なし
                              </div>
                            )}

                            {task.completed && task.status === 'completed' && (
                              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                <History size={11} />
                                完了: {formatDate(task.completed)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {(accessToken || isDemo) && activeTab === 'active' && (
        <button
          type="button"
          title={taskFormExpanded ? '追加パネルを閉じる' : 'タスクを追加'}
          onClick={() => setTaskFormExpanded((v) => !v)}
          className="ui-fab fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-[1.03] active:scale-95 focus:outline-none sm:bottom-6 sm:right-6 xl:bottom-8 xl:right-10"
          aria-expanded={taskFormExpanded}
        >
          {taskFormExpanded ? <X size={26} /> : <Plus size={26} />}
        </button>
      )}

      {periodModalPeriod && (() => {
        const periodTitleMap = { week: '今週のタスク', nextWeek: '来週のタスク', month: '今月のタスク' };
        const sourceTasks =
          periodModalPeriod === 'week'
            ? weeklyStats.tasks
            : periodModalPeriod === 'nextWeek'
              ? nextWeekStats.tasks
              : monthStats.tasks;
        const modalTasks = sourceTasks
          .map((snapshot) => tasks.find((x) => x.id === snapshot.id) ?? snapshot)
          .sort((a, b) => (a.due ? new Date(a.due).getTime() : Infinity) - (b.due ? new Date(b.due).getTime() : Infinity));

        const mTot = modalTasks.length;
        const mComp = modalTasks.filter((t) => t.status === 'completed').length;
        const mRate = mTot === 0 ? 0 : Math.round((mComp / mTot) * 100);

        const mTagData = {};
        modalTasks.forEach((t) => {
          const tagList = t.tags.length === 0 ? ['未分類'] : t.tags;
          tagList.forEach((tag) => {
            if (!mTagData[tag]) mTagData[tag] = { t: 0, c: 0 };
            mTagData[tag].t++;
            if (t.status === 'completed') mTagData[tag].c++;
          });
        });

        const grouped = {};
        modalTasks.forEach((t) => {
          const dateLabel = t.due ? formatDue(t.due).split(' ')[0] : '期限なし';
          if (!grouped[dateLabel]) grouped[dateLabel] = [];
          grouped[dateLabel].push(t);
        });
        const groupedEntries = Object.entries(grouped).sort(([ka, aTasks], [kb, bTasks]) => {
          if (ka === '期限なし') return 1;
          if (kb === '期限なし') return -1;
          const minA = Math.min(...aTasks.map((x) => (x.due ? new Date(x.due).getTime() : Infinity)));
          const minB = Math.min(...bTasks.map((x) => (x.due ? new Date(x.due).getTime() : Infinity)));
          return minA - minB;
        });

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in [perspective:1200px]"
            onClick={() => setPeriodModalPeriod(null)}
            role="presentation"
          >
            <div
              className={`bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 ${periodModalTiltDeg !== 0 ? 'period-modal-3d-panel' : ''}`}
              style={{ '--period-from-tilt': `${periodModalTiltDeg}deg` }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="period-modal-title"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 shrink-0 gap-2">
                <div className="min-w-0">
                  <h3 id="period-modal-title" className="font-bold text-slate-800">{periodTitleMap[periodModalPeriod]}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">← → 期間切替 · Esc で閉じる</p>
                </div>
                <button type="button" onClick={() => setPeriodModalPeriod(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition shrink-0" aria-label="閉じる">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100 bg-white shrink-0 space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>全体の進捗</span>
                    <span>{mRate}% ({mComp}/{mTot})</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${mRate === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`} style={{ width: `${mRate}%` }} />
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
                            <div className={`h-1 rounded-full ${r === 100 ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${r}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto p-4 space-y-5 bg-slate-50/50">
                {modalTasks.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">タスクがありません</p>
                ) : (
                  groupedEntries.map(([dateLabel, gTasks]) => {
                    const sorted = [...gTasks].sort((a, b) => (a.due ? new Date(a.due).getTime() : 0) - (b.due ? new Date(b.due).getTime() : 0));
                    return (
                      <div key={dateLabel}>
                        <h4 className="text-xs font-bold text-slate-500 mb-2 border-b border-slate-200 pb-1">{dateLabel}</h4>
                        <div className="space-y-2">
                          {sorted.map((task) => {
                            const overdue = task.status !== 'completed' && isOverdue(task.due);
                            return (
                              <div key={task.id} className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                <button type="button" onClick={() => toggleTaskStatus(task)} className="mt-0.5 shrink-0 focus:outline-none transition-transform active:scale-90">
                                  {task.status === 'completed'
                                    ? <CheckCircle2 size={18} className="text-emerald-500" />
                                    : <Circle size={18} className={overdue ? 'text-red-400' : 'text-slate-300'} />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium whitespace-normal break-words leading-tight ${task.status === 'completed' ? 'line-through text-slate-400' : overdue ? 'text-red-700' : 'text-slate-800'}`}>
                                    {task.cleanTitle}
                                  </p>
                                  {((task.platforms?.length > 0) || (task.tags?.length > 0)) && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {(task.platforms || []).map((p) => (
                                        <span key={p} className={`text-[9px] px-1.5 py-px rounded border ${getLmsBadgeClass(p)}`}>{p}</span>
                                      ))}
                                      {(task.tags || []).map((tag) => (
                                        <span key={tag} className={`text-[9px] px-1.5 py-px rounded border ${getTagColor(tag)}`}>{tag}</span>
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

function CalendarView({ tasks, mode, setMode, cursor, setCursor, toggleTaskStatus, getTagColor }) {
  const [dateBase, setDateBase] = useState('due'); // 'due' | 'completed'
  const now = new Date();
  const { start: weekStart } = getWeekRange(cursor);

  const goPrev = () => {
    const d = new Date(cursor);
    if (mode === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCursor(d);
  };
  const goNext = () => {
    const d = new Date(cursor);
    if (mode === 'month') d.setMonth(d.getMonth() + 1);
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

  const tasksForDay = (dayDate) =>
    tasks.filter(t => {
      if (dateBase === 'completed') {
        if (t.status !== 'completed' || !t.completed) return false;
        return dueMatchesCalendarDay(t.completed, dayDate);
      } else {
        if (!t.due) return false;
        return dueMatchesCalendarDay(t.due, dayDate);
      }
    });

  const renderTaskRow = (task) => {
    const done = task.status === 'completed';
    const overdue = !done && task.due && isOverdue(task.due);
    return (
      <div key={task.id} className={`flex items-start gap-1.5 py-1.5 text-left border-b border-slate-100/80 last:border-0 ${done ? 'opacity-50' : ''}`}>
        <button
          type="button"
          onClick={() => toggleTaskStatus(task)}
          className="mt-0.5 shrink-0 focus:outline-none"
        >
          {done ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Circle size={14} className={overdue ? 'text-red-400' : 'text-slate-300'} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] sm:text-[11px] leading-snug break-words whitespace-normal hyphens-auto ${done ? 'line-through text-slate-400' : overdue ? 'text-red-700 font-medium' : 'text-slate-700'}`}>
            {task.cleanTitle}
          </p>
          {((task.platforms?.length > 0) || (task.tags?.length > 0)) && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {(task.platforms || []).map(p => (
                <span key={p} className={`text-[8px] px-1 py-px rounded border leading-tight ${getLmsBadgeClass(p)}`}>{p}</span>
              ))}
              {(task.tags || []).map(tag => (
                <span key={tag} className={`text-[8px] px-1 py-px rounded border leading-tight ${getTagColor(tag)}`}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <button type="button" onClick={() => setMode('month')} className={`px-3 py-1.5 text-xs font-semibold transition ${mode === 'month' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>月</button>
            <button type="button" onClick={() => setMode('week')} className={`px-3 py-1.5 text-xs font-semibold transition ${mode === 'week' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>週</button>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm ml-2">
            <button type="button" onClick={() => setDateBase('due')} className={`px-3 py-1.5 text-xs font-semibold transition ${dateBase === 'due' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>設定日</button>
            <button type="button" onClick={() => setDateBase('completed')} className={`px-3 py-1.5 text-xs font-semibold transition ${dateBase === 'completed' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>完了日</button>
          </div>
          <button type="button" onClick={() => setCursor(new Date())} className="text-xs font-medium text-violet-600 hover:underline px-2 ml-auto sm:ml-0">今日へ</button>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-2">
          <button type="button" onClick={goPrev} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" aria-label="前へ">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[160px] text-center">
            {mode === 'month' ? `${y}年 ${m + 1}月` : formatWeekLabel(weekStart)}
          </span>
          <button type="button" onClick={goNext} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" aria-label="次へ">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {mode === 'month' ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200 min-w-[560px]">
            {CAL_WEEK_LABELS.map(lab => (
              <div key={lab} className="bg-slate-50 text-center text-[11px] font-semibold text-slate-500 py-2">{lab}</div>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const cellDate = new Date(gridStart);
              cellDate.setDate(gridStart.getDate() + i);
              const inMonth = cellDate.getMonth() === m;
              const isTodayCell = sameLocalDay(cellDate, now);
              const dayTasks = tasksForDay(cellDate);
              return (
                <div
                  key={i}
                  className={`min-h-[148px] p-1.5 bg-white ${!inMonth ? 'opacity-45 bg-slate-50' : ''} ${isTodayCell ? 'ring-1 ring-inset ring-violet-400' : ''}`}
                >
                  <div className={`text-[11px] font-semibold mb-1 shrink-0 ${isTodayCell ? 'text-violet-600' : 'text-slate-700'}`}>
                    {cellDate.getDate()}
                  </div>
                  <div className="max-h-[200px] overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
                    {dayTasks.length === 0 ? (
                      <span className="text-[9px] text-slate-300"> </span>
                    ) : (
                      dayTasks.map(renderTaskRow)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const isTodayCell = sameLocalDay(d, now);
            const dayTasks = tasksForDay(d);
            return (
              <div key={i} className={`border rounded-xl p-2 min-h-[260px] flex flex-col ${isTodayCell ? 'border-violet-400 bg-violet-50/25' : 'border-slate-200 bg-slate-50/20'}`}>
                <div className={`text-xs font-bold mb-2 pb-2 border-b shrink-0 ${isTodayCell ? 'text-violet-600 border-violet-200' : 'text-slate-700 border-slate-200'}`}>
                  {d.getMonth() + 1}/{d.getDate()} <span className="font-normal text-slate-500">({WEEKDAYS[d.getDay()]})</span>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[min(420px,55vh)] overscroll-contain">
                  {dayTasks.length === 0 ? (
                    <p className="text-[10px] text-slate-400">タスクなし</p>
                  ) : (
                    dayTasks.map(renderTaskRow)
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

function PeriodCard({ label, icon, stats, accent, onClick }) {
  const { completed, totalTarget, rate } = stats;
  const isEmpty = totalTarget === 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="bg-white ui-panel rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between items-start cursor-pointer hover:border-[var(--ui-accent)] hover:shadow-md transition-all h-full"
    >
      <div className="w-full">
        <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
          {icon}{label}
        </p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className={`text-2xl font-bold ${accent}`}>{completed}</span>
          <span className="text-slate-400 text-lg font-semibold">/</span>
          <span className="text-lg font-semibold text-slate-600">{totalTarget}</span>
        </div>
      </div>
      <div className="mt-4 w-full">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${isEmpty ? 'bg-slate-200' : rate === 100 ? 'bg-emerald-400' : 'bg-[var(--ui-accent)]'
              }`}
            style={{ width: `${isEmpty ? 0 : rate}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          {isEmpty ? '対象タスクなし' : `達成率 ${rate}%`}
        </p>
      </div>
    </div>
  );
}

function RoutineDetectorView({
  routineGroups, selectedRoutine, toggleTaskStatus, selectedTasks, toggleSelection,
  setSelectedTasks, handleDeleteSelected, showCheckboxes,
  selectionMode, setSelectionMode, showCompleted, setShowCompleted
}) {

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setSelectionMode((prev) => { if (prev) setSelectedTasks(new Set()); return !prev; }); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition border shrink-0 ${selectionMode ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {selectionMode ? '選択終了' : '選択モード'}
          </button>
          <span className="text-[10px] text-slate-400 hidden sm:inline">Shiftキー長押しでも複数選択可</span>
        </div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-600 cursor-pointer hover:text-slate-800">
          <input type="checkbox" checked={!showCompleted} onChange={(e) => setShowCompleted(!e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
          達成済を隠す
        </label>
      </div>

      {selectedTasks.size > 0 && (
        <div className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between sticky top-[80px] z-20 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium">{selectedTasks.size} 件を選択中</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelectedTasks(new Set())} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-lg">キャンセル</button>
            <button type="button" onClick={handleDeleteSelected} className="px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-1.5"><Trash2 size={14} /> 削除</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {routineGroups.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
            <Layers size={40} className="mx-auto mb-3 opacity-20" />
            <p>該当するタスクはありません</p>
          </div>
        ) : (
          routineGroups.map((group, idx) => {
            const sortedTasks = [...group.tasks]
              .filter((t) => showCompleted || t.status !== 'completed')
              .sort((a, b) => {
                const da = a.due ? new Date(a.due).getTime() : Infinity;
                const db = b.due ? new Date(b.due).getTime() : Infinity;
                return da - db;
              });

            if (sortedTasks.length === 0) return null;

            const isHighlighted = selectedRoutine === (group.titleLabel || group.title);
            
            return (
              <div key={group.titleLabel || group.title + String(idx)} className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col transition-all duration-300 ${isHighlighted ? 'ring-2 ring-amber-400 border-amber-200 scale-[1.01]' : 'border-slate-100'}`}>
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-base truncate flex-1 pr-4" title={group.titleLabel || group.title}>{group.titleLabel || group.title}</h3>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">{group.count} 件</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-400 h-1.5 rounded-full transition-all" style={{ width: `${(group.completedCount / (group.count || 1)) * 100}%` }} />
                    </div>
                    <span>{Math.round((group.completedCount / (group.count || 1)) * 100)}% ({group.completedCount}/{group.count})</span>
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
                        ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
                        return next;
                      });
                    }}
                    className="text-xs flex items-center gap-1 px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                  >
                    {group.tasks.every(t => selectedTasks.has(t.id)) ? <CheckSquare size={14} className="text-blue-600"/> : <Circle size={14}/>}
                    {group.tasks.every(t => selectedTasks.has(t.id)) ? 'グループ解除' : 'グループ選択'}
                  </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50 p-2">
                  {sortedTasks.map((task) => {
                    const done = task.status === 'completed';
                    const isSelected = selectedTasks.has(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => { if (showCheckboxes) toggleSelection(task.id); }}
                        className={`flex items-start gap-3 p-2 rounded-lg transition group ${showCheckboxes ? 'cursor-pointer' : ''
                          } ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-slate-50'}`}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                          className="mt-0.5 shrink-0 focus:outline-none transition-transform active:scale-90"
                        >
                          {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-300 group-hover:text-blue-500 transition" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.cleanTitle}</p>
                          {task.due && <p className="text-[10px] text-slate-400 mt-0.5">{new Date(task.due).toLocaleDateString()}</p>}
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
      .filter(s => s.tag !== '未分類')
      .map(s => {
        const gTasks = tasks.filter(t => t.tags.includes(s.tag));
        const completedCount = gTasks.filter(t => t.status === 'completed').length;
        return { 
          title: s.tag, 
          titleLabel: s.tag, 
          activeCount: gTasks.length - completedCount,
          count: gTasks.length, 
          completedCount, 
          tasks: gTasks 
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [tagStats, tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="text-rose-500" size={24} />
        <h2 className="text-xl font-bold text-slate-800">タグ管理</h2>
        <span className="text-xs text-slate-400 ml-2">タグごとのタスク状況を一括管理</span>
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
  const maxTotal = Math.max(1, ...series.map(w => w.total));
  const W = 700, H = 260, PAD = { t: 24, b: 32, l: 40, r: 40 };
  const barAreaH = H - PAD.t - PAD.b;
  
  const segment = (W - PAD.l - PAD.r) / (series.length || 1);
  const barW = Math.min(32, segment - 8);
  const xOfBar = (i) => PAD.l + i * segment + segment / 2;
  const yOfRate = (rate) => PAD.t + barAreaH * (1 - rate / 100);
  const yOfBar = (val) => PAD.t + barAreaH * (1 - val / maxTotal);
  const barH = (val) => barAreaH * (val / maxTotal);

  const points = series.map((w, i) => `${xOfBar(i)},${yOfRate(w.rate)}`).join(' ');

  return (
    <div className="overflow-x-auto hide-scrollbar pb-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px] drop-shadow-sm" style={{ fontFamily: 'var(--ui-font)' }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ui-accent)" />
            <stop offset="100%" stopColor="var(--ui-accent-dark)" />
          </linearGradient>
        </defs>
        
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={`grid-${t}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + barAreaH * t} y2={PAD.t + barAreaH * t} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.l - 8} y={PAD.t + barAreaH * t + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(maxTotal * (1 - t))}</text>
            <text x={W - PAD.r + 8} y={PAD.t + barAreaH * t + 3} textAnchor="start" fontSize="10" fill="#94a3b8">{Math.round((1 - t) * 100)}%</text>
          </g>
        ))}
        
        {series.map((w, i) => (
          <rect key={`tot-${i}`} x={xOfBar(i) - barW/2} y={yOfBar(w.total)} width={barW} height={barH(w.total)}
            fill="var(--ui-accent-light)" rx="4" opacity="0.6" />
        ))}
        
        {series.map((w, i) => (
          <rect key={`comp-${i}`} x={xOfBar(i) - barW/2} y={yOfBar(w.completed)} width={barW} height={barH(w.completed)}
            fill="url(#barGrad)" rx="4" className={w.isFuture ? 'opacity-40' : 'opacity-95'} />
        ))}

        <polyline points={points} fill="none" stroke="var(--ui-accent-dark)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        
        {series.map((w, i) => (
          <g key={`point-${i}`}>
            <circle cx={xOfBar(i)} cy={yOfRate(w.rate)} r="4" fill="#ffffff" stroke="var(--ui-accent-dark)" strokeWidth="2" />
            {w.total > 0 && (
              <text x={xOfBar(i)} y={yOfRate(w.rate) - 10} textAnchor="middle" fontSize="11" fill="var(--ui-accent-dark)" fontWeight="800">
                {w.rate}%
              </text>
            )}
            <text x={xOfBar(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={w.isCurrent ? 'var(--ui-accent-dark)' : '#64748b'} fontWeight={w.isCurrent ? '800' : '500'}>
              {labelFor(w)}
            </text>
          </g>
        ))}
        
        <g transform={`translate(${PAD.l}, 8)`}>
          <rect width="10" height="10" fill="var(--ui-accent-light)" rx="2" /><text x="14" y="9" fontSize="10" fill="#64748b">設定数</text>
          <rect x="65" width="10" height="10" fill="url(#barGrad)" rx="2" /><text x="79" y="9" fontSize="10" fill="#64748b">完了数 (左軸)</text>
          <line x1="150" y1="5" x2="165" y2="5" stroke="var(--ui-accent-dark)" strokeWidth="2" /><circle cx="157.5" cy="5" r="3" fill="#fff" stroke="var(--ui-accent-dark)" strokeWidth="1.5" /><text x="170" y="9" fontSize="10" fill="#64748b">達成率 (右軸)</text>
        </g>
      </svg>
    </div>
  );
}

function BatchReplaceView({ tasks, accessToken, fetchRealTasks, isDemo }) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replacing, setReplacing] = useState(false);

  const matchedTasks = tasks.filter(t => searchText && t.title.includes(searchText) && t.status !== 'completed');

  const handleReplace = async () => {
    if (!searchText) return;
    const targetTasks = matchedTasks.slice(0, 10);
    if (targetTasks.length === 0) return;
    if (!window.confirm(`${targetTasks.length}件のタスク名を置換しますか？`)) return;
    
    setReplacing(true);
    if (!isDemo) {
      try {
        await Promise.all(targetTasks.map(task => {
          const newTitle = task.title.replace(new RegExp(searchText, 'g'), replaceText);
          return fetch(`https://tasks.googleapis.com/tasks/v1/lists/${task.listId}/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
          });
        }));
        fetchRealTasks(accessToken);
        alert(`${targetTasks.length}件の置換が完了しました。さらに置換が必要な場合は再度実行してください。`);
      } catch (e) {
        alert("一部の置換に失敗しました。");
      }
    } else {
       alert("デモモードではAPIは呼び出されません");
    }
    setReplacing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><RefreshCw className="text-cyan-500" size={20}/> タスク名一括置換</h2>
      <p className="text-xs text-slate-500">API制限を避けるため、一度に最大10件ずつ置換を実行します。</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">検索文字列</label>
          <input type="text" placeholder="例: 課題1" value={searchText} onChange={e => setSearchText(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"/>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">置換後文字列</label>
          <input type="text" placeholder="例: Report 1" value={replaceText} onChange={e => setReplaceText(e.target.value)} className="w-full border border-slate-200 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"/>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm font-medium text-slate-600">一致件数: <span className="text-blue-600">{matchedTasks.length}</span> 件</p>
        <button onClick={handleReplace} disabled={replacing || matchedTasks.length === 0} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50 transition hover:bg-blue-700 shadow-md active:scale-[0.98]">
          {replacing ? '置換中...' : `上から10件を置換実行`}
        </button>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 mt-2 bg-slate-50 shadow-inner">
        {matchedTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-300">置換対象のタスクが見つかりませんでした</div>
        ) : (
          matchedTasks.map(t => (
            <div key={t.id} className="p-4 text-sm flex flex-col gap-2 bg-white m-2 rounded-lg border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 text-red-500/60 line-through text-xs font-medium">
                <span className="shrink-0 bg-red-50 px-1 rounded">BEFORE</span> {t.title}
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <span className="shrink-0 bg-emerald-50 px-1 rounded text-xs">AFTER</span> {t.title.replace(new RegExp(searchText, 'g'), replaceText)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AnalyticsView({ tasks, weeklyHistory, monthlyHistory, yearlyHistory, overallCompletionRate, totalTasks, completedTasks, tagStats, selectedTag, toggleTaskStatus, averageLeadTime, onTimeTasks, lateTasks }) {
  const [granularity, setGranularity] = useState('week');
  const [expandedRow, setExpandedRow] = useState(null);
  const series = granularity === 'week' ? weeklyHistory : granularity === 'month' ? monthlyHistory : yearlyHistory;

  useEffect(() => setExpandedRow(null), [granularity]);

  const scopeHint = selectedTag ? `（タグ「${selectedTag}」のタスクのみ）` : '';
  const chartTitle =
    granularity === 'week' ? `週次（過去7週＋今週＋来週）${scopeHint}`
      : granularity === 'month' ? `月次（過去12ヶ月）${scopeHint}`
        : `年次（過去5年）${scopeHint}`;

  const labelFor = (w) => {
    if (granularity === 'week') {
      if (w.isCurrent) return '今週';
      if (w.isFuture) return '来週';
      return w.label;
    }
    if (granularity === 'month') {
      return w.isCurrent ? '今月' : w.shortLabel || w.label;
    }
    return w.isCurrent ? '今年' : w.label;
  };

  const overdueList = tasks.filter((t) => t.status !== 'completed' && t.due && new Date(t.due).getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000).sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return (
    <div className="space-y-6">
      {/* 複合グラフ（タスク数 ＆ 達成率） */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-indigo-600" /> タスク量と達成率の推移</h3>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
            {[{ id: 'week', label: '週次' }, { id: 'month', label: '月次' }, { id: 'year', label: '年次' }].map(({ id, label }) => (
              <button key={id} onClick={() => setGranularity(id)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${granularity === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">{chartTitle}</p>
        
        {/* CompositeChart を利用した複合グラフ */}
        <CompositeChart series={series} labelFor={labelFor} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-blue-500" />
            完了ペース分析
          </p>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">平均完了日</span>
                <p className="text-2xl font-bold text-slate-800">{averageLeadTime === 0 ? '当日' : averageLeadTime > 0 ? `${averageLeadTime.toFixed(1)} 日前` : `${Math.abs(averageLeadTime).toFixed(1)} 日遅延`}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${averageLeadTime >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {averageLeadTime >= 0 ? '良好' : '改善の余地あり'}
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
                {weeklyHistory.slice(-8).reverse().map(w => {
                  const wTasks = w.tasks || [];
                  let wEarly = 0, wOnTime = 0, wLate = 0;
                  wTasks.forEach(t => {
                    if (t.status === 'completed' && t.completed && t.due) {
                      const c = new Date(t.completed).getTime(), d = new Date(t.due).getTime();
                      if (c <= d - 86400000) wEarly++;
                      else if (c <= d + 86400000) wOnTime++;
                      else wLate++;
                    }
                  });
                  const tot = Math.max(wEarly + wOnTime + wLate, 1);
                  return (
                    <div key={w.key}>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span className={w.isCurrent ? 'font-bold text-indigo-600' : ''}>{w.isCurrent ? '今週' : w.label}</span>
                        <span>前{wEarly} / 当{wOnTime} / 遅{wLate}</span>
                      </div>
                      <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                        <div className="bg-emerald-400 transition-all" style={{ width: `${(wEarly/tot)*100}%` }} />
                        <div className="bg-blue-400 transition-all" style={{ width: `${(wOnTime/tot)*100}%` }} />
                        <div className="bg-rose-400 transition-all" style={{ width: `${(wLate/tot)*100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><AlertCircle size={18} className="text-red-500" /> 長期滞留アラート</h3>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mt-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-500" /> 完了ペース推移 ({granularity === 'week' ? '週次' : granularity === 'month' ? '月次' : '年次'})</h3>
        <p className="text-xs text-slate-500 mb-3">設定された期限に対する完了タイミング（期限設定ありのタスクのみ）</p>
        
        <div className="flex items-end gap-1 sm:gap-2 h-40 px-1 sm:px-2 border-b border-slate-100 overflow-x-auto">
          {series.map(w => {
            const wTasks = w.tasks || [];
            let e = 0, o = 0, l = 0;
            wTasks.forEach(t => {
              if (t.status === 'completed' && t.completed && t.due) {
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
            const maxPaceTot = Math.max(1, ...series.map(x => {
              let count = 0;
              (x.tasks || []).forEach(t => { if(t.status === 'completed' && t.completed && t.due) count++; });
              return count;
            }));
            const heightPct = tot === 0 ? 0 : (tot / maxPaceTot) * 100;

            return (
              <div key={w.key} className="flex-1 min-w-[28px] flex flex-col items-center justify-end h-full group relative">
                <span className="text-[10px] text-slate-600 font-bold mb-1 opacity-0 group-hover:opacity-100 transition absolute -top-6 whitespace-nowrap z-20 bg-white px-2 py-1 border border-slate-200 rounded shadow-lg pointer-events-none">
                  前:{e} 当:{o} 遅:{l}
                </span>
                <div className="w-full max-w-[20px] flex flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: `${heightPct}%`, minHeight: tot === 0 ? '0' : '4px' }}>
                  <div className="w-full bg-amber-400 transition-all hover:opacity-80" style={{ height: `${hL}%` }} title={`遅延: ${l}`}/>
                  <div className="w-full bg-blue-400 transition-all hover:opacity-80" style={{ height: `${hO}%` }} title={`当日: ${o}`}/>
                  <div className="w-full bg-emerald-400 transition-all hover:opacity-80" style={{ height: `${hE}%` }} title={`期限前: ${e}`}/>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-2 px-1 sm:px-2 overflow-x-auto">
          {series.map(w => (<div key={`lp-${w.key}`} className="flex-1 min-w-[28px] text-[9px] sm:text-[10px] text-center truncate text-slate-500">{labelFor(w)}</div>))}
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></span>期限前</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400"></span>当日</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>遅延</div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">{granularity === 'week' ? '週次' : granularity === 'month' ? '月次' : '年次'}の詳細 <span className="text-xs font-normal text-slate-400 ml-2">行をクリックしてタスクを展開</span></p>
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
                const tasksDone = rowTasks.filter((t) => t.status === 'completed');
                const tasksUndone = rowTasks.filter((t) => t.status !== 'completed');

                return (
                  <React.Fragment key={`t-${w.key}`}>
                    <tr onClick={() => setExpandedRow(isExpanded ? null : w.key)} className={`border-b border-slate-50 last:border-0 cursor-pointer transition hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}>
                      <td className="py-2.5 pr-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-300 shrink-0" />}
                          {granularity === 'week' && w.isCurrent ? <span className="font-semibold text-indigo-600">今週 <span className="text-slate-400 font-normal">({w.label})</span></span> : granularity === 'week' && w.isFuture ? <span className="text-slate-500">来週 <span className="text-slate-400">({w.label})</span></span> : w.label}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">{w.total}</td>
                      <td className="py-2.5 pr-4 text-slate-600">{w.completed}</td>
                      <td className="py-2.5 pr-4 font-semibold">
                        <span className={w.total === 0 ? 'text-slate-300' : w.rate >= 80 ? 'text-emerald-600' : w.rate >= 50 ? 'text-blue-600' : 'text-amber-600'}>{w.total === 0 ? '-' : `${w.rate}%`}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="bg-slate-50 border-b border-slate-100 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                              <h5 className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 inline-block sticky top-0 z-10">未達成 ({tasksUndone.length})</h5>
                              {tasksUndone.length === 0 ? <p className="text-xs text-slate-400 px-1">なし</p> : tasksUndone.map((t) => (
                                <div key={t.id} className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-slate-200 shadow-sm">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleTaskStatus(t); }} className="mt-0.5 shrink-0"><Circle size={12} className="text-slate-300 hover:text-blue-500" /></button>
                                  <span className="text-slate-700 leading-tight">{t.cleanTitle}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                              <h5 className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 inline-block sticky top-0 z-10">達成済 ({tasksDone.length})</h5>
                              {tasksDone.length === 0 ? <p className="text-xs text-slate-400 px-1">なし</p> : tasksDone.map((t) => (
                                <div key={t.id} className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-slate-200 shadow-sm opacity-70">
                                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleTaskStatus(t); }} className="mt-0.5 shrink-0"><CheckCircle2 size={12} className="text-emerald-500" /></button>
                                  <span className="text-slate-500 line-through leading-tight">{t.cleanTitle}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 inline-block">期間内のタグ構成</h5>
                              {(() => {
                                const periodTagCounts = {};
                                let periodTaggedTotal = 0;
                                rowTasks.forEach(t => {
                                  const tgs = t.tags.length > 0 ? t.tags : ['未分類'];
                                  tgs.forEach(tag => {
                                    periodTagCounts[tag] = (periodTagCounts[tag] || 0) + 1;
                                    periodTaggedTotal++;
                                  });
                                });
                                const periodTagStats = Object.entries(periodTagCounts)
                                  .map(([tag, count]) => ({ tag, count, rate: Math.round((count / (periodTaggedTotal || 1)) * 100) }))
                                  .sort((a, b) => b.count - a.count);

                                return periodTagStats.length === 0 ? <p className="text-xs text-slate-400 px-1">データなし</p> : (
                                  <div className="space-y-2.5 mt-2 bg-white p-3 rounded border border-slate-200 shadow-sm">
                                    {periodTagStats.map(t => (
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
    </div>
  );
}

function UISettingsView({ uiConfig, setUiConfig }) {
  const update = (key, val) => setUiConfig(prev => ({ ...prev, [key]: val }));
  const applyPreset = (config) => setUiConfig(config);

  const Section = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
      <h3 className="font-bold text-sm uppercase tracking-wider opacity-80">{title}</h3>
      {children}
    </div>
  );

  const OptionRow = ({ label, options, current, onChange }) => (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100/10 pb-4 last:border-0 last:pb-0">
      <span className="text-sm font-semibold w-40 shrink-0 opacity-80">{label}</span>
      <div className="flex-1 p-1.5 rounded-xl border" style={{ background: 'var(--ui-accent-light)' }}>
        <AnimatedToggle options={options} current={current} onChange={onChange} className="w-full" optionClassName="flex-1 min-w-[80px]" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2 px-2">
        <Settings className="opacity-80" size={28} />
        <h2 className="text-2xl font-bold">UI / デザイン設定</h2>
      </div>

      <Section title="🎨 デザインプリセット (テーマの特徴が一目でわかる30選)">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {THEME_PRESETS.map((preset) => {
            const bgColors = { white: '#ffffff', light: '#f8fafc', paper: '#fdfcf8', gray: '#e5e7eb', dark: '#1e293b', navy: '#0a0a2a', pitchBlack: '#000000', cream: '#fefce8', sepia: '#f3e8d2' };
            const textColors = { white: '#0f172a', light: '#1e293b', paper: '#3f3e3a', gray: '#1f2937', dark: '#f8fafc', navy: '#e0e7ff', pitchBlack: '#ffffff', cream: '#451a03', sepia: '#433422' };
            const accentColors = { blue: '#2563eb', indigo: '#4f46e5', emerald: '#059669', teal: '#0d9488', cyan: '#0891b2', rose: '#e11d48', fuchsia: '#c026d3', amber: '#d97706', violet: '#7c3aed', slate: '#64748b', zinc: '#52525b', white: '#ffffff', black: '#09090b', gold: '#d4af37', bronze: '#cd7f32', sand: '#e7e5e4' };

            const bgColor = bgColors[preset.config.bgTheme] || '#ffffff';
            const textColor = textColors[preset.config.bgTheme] || '#0f172a';
            const accentColor = accentColors[preset.config.accent] || '#2563eb';

            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.config)}
                className="flex items-center gap-3 p-3 border-2 border-slate-200/60 rounded-xl hover:border-blue-500 hover:shadow-md transition active:scale-95 text-left bg-white"
              >
                {/* カラーパレットプレビュー */}
                <div className="flex shrink-0 -space-x-2">
                  <span className="w-8 h-8 rounded-full border-2 border-white shadow-sm z-10" style={{ backgroundColor: bgColor }} title="背景色" />
                  <span className="w-8 h-8 rounded-full border-2 border-white shadow-sm z-20" style={{ backgroundColor: textColor }} title="文字色" />
                  <span className="w-8 h-8 rounded-full border-2 border-white shadow-sm z-30" style={{ backgroundColor: accentColor }} title="アクセント" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-bold text-xs truncate text-slate-800">{preset.name}</span>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{preset.config.bgTheme}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{preset.config.texture}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="🛠️ カスタム詳細設定">
        <div className="space-y-4">
          <OptionRow label="言語 / 演出" current={uiConfig.language} onChange={v => update('language', v)}
            options={[
              { value: 'ja', label: '日本語' },
              { value: 'en_mix', label: '一部英語' },
              { value: 'en', label: 'フル英語' },
            ]} />

          <OptionRow label="アイコンの太さ" current={uiConfig.iconWeight} onChange={v => update('iconWeight', v)}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'normal', label: 'Normal' },
              { value: 'bold', label: 'Bold' },
            ]} />

          <OptionRow label="アニメーション" current={uiConfig.animation} onChange={v => update('animation', v)}
            options={[
              { value: 'smooth', label: 'オン (滑らか)' },
              { value: 'off', label: 'オフ (即時反映)' },
            ]} />

          <OptionRow label="ベーステーマ" current={uiConfig.bgTheme} onChange={v => update('bgTheme', v)}
            options={[
              { value: 'white', label: 'ピュアホワイト' },
              { value: 'light', label: 'ライト' },
              { value: 'paper', label: 'ペーパー' },
              { value: 'gray', label: 'グレー' },
              { value: 'dark', label: 'ダーク' },
              { value: 'navy', label: 'ネイビー' },
              { value: 'pitchBlack', label: 'ピッチブラック' },
            ]} />

          <OptionRow label="フォント" current={uiConfig.font} onChange={v => update('font', v)}
            options={[
              { value: 'sans', label: 'Noto Sans' },
              { value: 'serif', label: 'Noto Serif' },
              { value: 'mono', label: 'JetBrains Mono' },
              { value: 'rounded', label: 'M PLUS Rounded' },
              { value: 'shippori', label: 'Shippori Mincho' },
              { value: 'zenOld', label: 'Zen Old Mincho' },
              { value: 'zenKakuNew', label: 'Zen Kaku Gothic New' },
              { value: 'zenKakuAntique', label: 'Zen Kaku Gothic Antique' },
              { value: 'bizUD', label: 'BIZ UDPGothic' },
              { value: 'lineSeed', label: 'LINE Seed JP' },
            ]} />
            
          <OptionRow label="文字の太さ" current={uiConfig.weight} onChange={v => update('weight', v)}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'normal', label: 'Normal' },
              { value: 'medium', label: 'Medium' },
              { value: 'bold', label: 'Bold' },
              { value: 'black', label: 'Black' },
            ]} />

          <OptionRow label="角丸の強さ" current={uiConfig.radius} onChange={v => update('radius', v)}
            options={[
              { value: 'none', label: 'なし', preview: '▭' },
              { value: 'sm', label: '小', preview: '▢' },
              { value: 'md', label: '中', preview: '▣' },
              { value: 'lg', label: '大', preview: '◻' },
              { value: 'xl', label: '特大', preview: '⚪' },
            ]} />

          <OptionRow label="質感 (テクスチャ)" current={uiConfig.texture} onChange={v => update('texture', v)}
            options={[
              { value: 'flat', label: 'フラット' },
              { value: 'glass', label: 'ガラス' },
              { value: 'simple', label: 'シンプル' },
              { value: 'paper', label: 'ペーパー' },
              { value: 'neon', label: 'ネオン' },
              { value: 'liquid', label: 'リキッド' },
            ]} />

          <OptionRow label="余白 (密度)" current={uiConfig.density} onChange={v => update('density', v)}
            options={[
              { value: 'compact', label: 'コンパクト' },
              { value: 'normal', label: '標準' },
              { value: 'loose', label: 'ゆったり' },
            ]} />

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 pt-2">
            <span className="text-sm font-semibold w-40 shrink-0 opacity-80">アクセントカラー</span>
            <div className="flex flex-wrap gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-200/50 flex-1">
              {[
                { value: 'blue', color: 'bg-blue-500' },
                { value: 'indigo', color: 'bg-indigo-500' },
                { value: 'emerald', color: 'bg-emerald-500' },
                { value: 'teal', color: 'bg-teal-500' },
                { value: 'cyan', color: 'bg-cyan-500' },
                { value: 'rose', color: 'bg-rose-500' },
                { value: 'fuchsia', color: 'bg-fuchsia-500' },
                { value: 'amber', color: 'bg-amber-500' },
                { value: 'violet', color: 'bg-violet-500' },
                { value: 'slate', color: 'bg-slate-500' },
                { value: 'zinc', color: 'bg-zinc-500' },
                { value: 'white', color: 'bg-white border border-slate-300' },
              ].map(({ value, color }) => (
                <button key={value} type="button" onClick={() => update('accent', value)} title={value}
                  className={"flex items-center justify-center w-8 h-8 rounded-full border-2 transition-transform " + (uiConfig.accent === value ? 'border-[var(--ui-accent)] scale-125' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-110')}>
                  <span className={"w-full h-full rounded-full shadow-sm " + color} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>
      <Section title="👁️ プレビュー">
        <div className="p-6 rounded-xl border flex flex-col items-start gap-4 relative overflow-hidden ui-highlight-bg">
          <button style={{ borderRadius: 'var(--ui-radius)', fontFamily: 'var(--ui-font)', color: 'var(--ui-accent)' }}
            className="px-6 py-2.5 inline-block text-sm font-bold shadow-md bg-white transition hover:brightness-110 active:scale-95 z-10">
            アクセントボタン
          </button>
          <div className="bg-white p-4 rounded-lg border max-w-lg w-full z-10">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              フォント・質感テスト
            </h4>
            <p className="text-xs leading-relaxed opacity-80 font-normal">
              The quick brown fox jumps over the lazy dog. 1234567890<br/>
              吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。
            </p>
          </div>
        </div>
      </Section>

      <div className="flex justify-end pt-2 pb-8">
        <button type="button"
          onClick={() => setUiConfig({ bgTheme: 'light', radius: 'md', font: 'sans', weight: 'medium', accent: 'blue', texture: 'flat', density: 'normal', animation: 'smooth', iconWeight: 'normal', language: 'en_mix' })}
          className="px-4 py-2 text-sm font-bold opacity-60 hover:opacity-100 border rounded-xl transition shadow-sm bg-transparent">
          設定をデフォルトにリセット
        </button>
      </div>
    </div>
  );
}
