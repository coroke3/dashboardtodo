import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Circle, AlertCircle, Play, Tag, LogOut,
  RefreshCw, LayoutDashboard, ListTodo, Calendar,
  Plus, X, History, Target, TrendingUp, BarChart3, CalendarOff,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Copy,
  Search, Layers, PieChart, Flame, Clock, Inbox, CheckSquare,
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
  const [shiftHeld, setShiftHeld] = useState(false);
  const [taskFormExpanded, setTaskFormExpanded] = useState(false);
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  /** 今週 / 来週 / 今月 ポップアップ（左右キーで切替） */
  const [periodModalPeriod, setPeriodModalPeriod] = useState(null);
  /** 期間モーダル切替時の 3D アニメ用（deg、0 で無効） */
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
    // accessToken / isDemo の変化時のみ再取得（fetchRealTasks は毎レンダーで新規のため依存に含めない）
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
  }, [tasks, selectedTag, showOnlyNoDue, searchQuery]);

  const routineGroups = useMemo(() => {
    // 1. 全タスクの全単語の出現回数をカウントする
    const wordCounts = {};
    tasks.forEach((t) => {
      const words = t.cleanTitle.split(/[\s,，、・\-()（）[\]［］{}｛｝]+/);
      words.forEach((w) => {
        if (w.length < 2 || /^[0-9０-９]+$/.test(w)) return;
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      });
    });

    // 2. 「高頻出単語」を自動選別する（3回以上登場＝ルーチン候補）
    const threshold = 3;
    const routineKeywords = Object.keys(wordCounts).filter(w => wordCounts[w] >= threshold);

    // 3. 各タスクについて、最も出現頻度の高いキーワードを「主軸」としてグループ化する
    const groups = {};
    tasks.forEach((t) => {
      const words = t.cleanTitle.split(/[\s,，、・\-()（）[\]［］{}｛｝]+/);
      const taskKeywords = words.filter(w => routineKeywords.includes(w));
      
      if (taskKeywords.length === 0) return;

      // 出現頻度が最も高いキーワードを主軸（グループ名）にする
      // 同じ頻度の場合は、より具体的な単語（長い単語）を優先
      const bestKeyword = taskKeywords.reduce((best, current) => {
        if (!best) return current;
        if (wordCounts[current] > wordCounts[best]) return current;
        if (wordCounts[current] === wordCounts[best] && current.length > best.length) return current;
        return best;
      }, null);

      if (!groups[bestKeyword]) {
        groups[bestKeyword] = { title: bestKeyword, count: 0, tasks: [] };
      }
      groups[bestKeyword].count += 1;
      groups[bestKeyword].tasks.push(t);
    });

    return Object.values(groups)
      .filter((g) => g.count >= threshold)
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

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
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200', 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-purple-100 text-purple-800 border-purple-200', 'bg-amber-100 text-amber-800 border-amber-200',
      'bg-rose-100 text-rose-800 border-rose-200', 'bg-indigo-100 text-indigo-800 border-indigo-200',
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
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
              <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-start gap-2 text-sm border border-red-100">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {ENV_CLIENT_ID && !clientIdOverrideOpen ? (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-900">
                <p className="font-medium">`.env` の <code className="text-xs bg-white/80 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> を使用します。</p>
                <button
                  type="button"
                  onClick={() => { setClientIdOverrideOpen(true); setClientId(localStorage.getItem('google_tasks_client_id') || ENV_CLIENT_ID || ''); }}
                  className="mt-2 text-xs text-emerald-800 underline hover:no-underline"
                >
                  別の Client ID を入力する
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Google Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder={ENV_CLIENT_ID ? ENV_CLIENT_ID : 'xxxx.apps.googleusercontent.com'}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                />
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  個人用ならプロジェクト直下の <code className="bg-slate-100 px-1 rounded">.env</code> に{' '}
                  <code className="bg-slate-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID=...</code> と書けば毎回の入力は不要です（再起動が必要）。
                </p>
                {ENV_CLIENT_ID && clientIdOverrideOpen && (
                  <button
                    type="button"
                    onClick={() => { setClientIdOverrideOpen(false); setClientId(localStorage.getItem('google_tasks_client_id') || ENV_CLIENT_ID || ''); }}
                    className="mt-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    環境変数の設定に戻す
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition shadow-sm disabled:opacity-70"
            >
              Googleアカウントで連携
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">または</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={loadDemo}
              disabled={loading}
              className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Play size={18} />
              デモデータで試す
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[100rem] mx-auto px-4 sm:px-6 xl:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <LayoutDashboard className="text-blue-600" size={24} />
            <h1 className="font-bold text-lg hidden sm:block">Task Dashboard</h1>
            {isDemo && <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">DEMO</span>}
          </div>

          {((accessToken && !error) || isDemo) && (
            <div className="flex-1 max-w-md relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="タスク、タグを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition"
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
            className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition relative w-10 h-10 flex flex-col justify-center items-center gap-1.5"
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
          <div className="sm:hidden border-t border-slate-100 bg-slate-50 px-4 py-4 flex flex-col gap-4 animate-in slide-in-from-top-2 shadow-inner">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setActiveTab('active'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Circle size={14} className="inline mr-1" /> アクティブ</button>
              <button type="button" onClick={() => { setActiveTab('history'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><History size={14} className="inline mr-1" /> 履歴</button>
              <button type="button" onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'calendar' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Calendar size={14} className="inline mr-1" /> カレンダー</button>
              <button type="button" onClick={() => { setActiveTab('analytics'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><BarChart3 size={14} className="inline mr-1" /> 分析</button>
              <button type="button" onClick={() => { setActiveTab('routines'); setIsMobileMenuOpen(false); }} className={`py-2 text-sm font-semibold rounded-lg border ${activeTab === 'routines' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}><Layers size={14} className="inline mr-1" /> ルーチン</button>
            </div>
            <div className="flex gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => { handleRefresh(); setIsMobileMenuOpen(false); }} className="flex-1 flex justify-center items-center gap-2 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 更新
              </button>
              <button type="button" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="flex-1 flex justify-center items-center gap-2 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-red-600">
                <LogOut size={16} /> 切断
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 xl:px-8 mt-6 flex flex-col xl:flex-row gap-6">
        <aside
          className="hidden xl:flex flex-col w-[280px] 2xl:w-[320px] shrink-0 gap-5 sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto hide-scrollbar pb-10"
        >
          <nav className="flex flex-col p-2 bg-white rounded-xl border border-slate-200 shadow-sm gap-1" aria-label="メインタブ">
            {[
              { id: 'active', icon: Circle, label: 'アクティブ', color: 'text-blue-600', bg: 'bg-blue-50' },
              { id: 'history', icon: History, label: '履歴', color: 'text-slate-800', bg: 'bg-slate-100' },
              { id: 'calendar', icon: Calendar, label: 'カレンダー', color: 'text-violet-600', bg: 'bg-violet-50' },
              { id: 'analytics', icon: BarChart3, label: '分析ダッシュボード', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { id: 'routines', icon: Layers, label: 'ルーチン検出', color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold text-sm transition ${
                    activeTab === tab.id ? `${tab.bg} ${tab.color} shadow-sm` : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <TabIcon size={18} strokeWidth={2.25} /> {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
              <Tag size={16} /> Tags
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition ${
                  selectedTag === null ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                すべて ({stats.total})
              </button>
              {tagStats.map((tagData) => (
                <button
                  type="button"
                  key={tagData.tag}
                  onClick={() => setSelectedTag(tagData.tag)}
                  className={`p-3 rounded-lg text-left transition flex flex-col gap-1.5 border ${
                    selectedTag === tagData.tag
                      ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          tagData.tag === '未分類' ? 'bg-slate-300' : getTagColor(tagData.tag).split(' ')[0]
                        }`}
                      />
                      <span className="text-sm font-medium">{tagData.tag}</span>
                    </div>
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {tagData.active > 0 ? tagData.active : '✓'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/70 rounded-full h-1 mt-0.5">
                    <div
                      className={`h-1 rounded-full ${tagData.rate === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`}
                      style={{ width: `${tagData.rate}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-6 pb-12 overflow-x-hidden">
          {/* === メイン領域上部：達成率ウィジェット（PC・モバイル共通） === */}
          <div className="flex gap-4 overflow-x-auto snap-x hide-scrollbar pb-2">
            <div className="min-w-[260px] flex-1 shrink-0 snap-start bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-xl text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-blue-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                  <TrendingUp size={16} /> 今週の達成率
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{weeklyStats.rate}</span>
                  <span className="text-lg text-blue-200">%</span>
                </div>
                <p className="text-xs text-blue-200 mt-2">
                  {weeklyStats.totalTarget === 0 ? '-' : `完了 ${weeklyStats.completed} / ${weeklyStats.totalTarget}`}
                </p>
              </div>
              <Target className="absolute -right-4 -bottom-4 text-white opacity-10" size={100} />
            </div>
            <div className="min-w-[160px] flex-1 shrink-0 snap-start">
              <PeriodCard
                label="今週"
                icon={<Calendar size={14} />}
                stats={weeklyStats}
                accent="text-blue-600"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod('week'); }}
              />
            </div>
            <div className="min-w-[160px] flex-1 shrink-0 snap-start">
              <PeriodCard
                label="来週"
                icon={<Calendar size={14} />}
                stats={nextWeekStats}
                accent="text-indigo-600"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod('nextWeek'); }}
              />
            </div>
            <div className="min-w-[160px] flex-1 shrink-0 snap-start">
              <PeriodCard
                label="今月"
                icon={<Calendar size={14} />}
                stats={monthStats}
                accent="text-emerald-600"
                onClick={() => { setPeriodModalTiltDeg(0); setPeriodModalPeriod('month'); }}
              />
            </div>
          </div>

          {/* === モバイル用 Tags 横並び（達成率・件数付き） === */}
          <div className="xl:hidden bg-white rounded-xl shadow-sm border border-slate-100 p-3 overflow-x-auto hide-scrollbar flex gap-3 snap-x">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`shrink-0 snap-start w-[140px] p-3 rounded-lg text-left transition flex flex-col gap-1.5 border ${
                selectedTag === null ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <div className="font-medium text-sm">すべて ({stats.total})</div>
              <div className="w-full bg-slate-200/30 rounded-full h-1 mt-0.5">
                <div className="h-1 rounded-full bg-slate-400" style={{ width: `${stats.total === 0 ? 0 : (stats.completed / stats.total) * 100}%` }} />
              </div>
            </button>
            {tagStats.map((tagData) => (
              <button
                type="button"
                key={tagData.tag}
                onClick={() => setSelectedTag(tagData.tag)}
                className={`shrink-0 snap-start w-[160px] p-3 rounded-lg text-left transition flex flex-col gap-1.5 border ${
                  selectedTag === tagData.tag ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${tagData.tag === '未分類' ? 'bg-slate-300' : getTagColor(tagData.tag).split(' ')[0]}`} />
                    <span className="text-sm font-medium truncate">{tagData.tag}</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
                    {tagData.active > 0 ? tagData.active : '✓'}
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-1 mt-0.5">
                  <div className={`h-1 rounded-full ${tagData.rate === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`} style={{ width: `${tagData.rate}%` }} />
                </div>
              </button>
            ))}
          </div>

          <div className="xl:hidden flex flex-wrap gap-2 p-1 bg-slate-200/60 rounded-lg w-full">
            {[
              { id: 'active', label: 'アクティブ' },
              { id: 'history', label: '履歴' },
              { id: 'calendar', label: 'カレンダー' },
              { id: 'analytics', label: '分析' },
              { id: 'routines', label: 'ルーチン' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[70px] py-2 text-xs font-semibold rounded-md transition ${
                  activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {searchQuery.trim() && (
            <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-lg border border-blue-200 flex items-center justify-between">
              <p className="text-sm">
                「<strong>{searchQuery}</strong>」の検索結果:{' '}
                <span className="font-bold">
                  {activeTab === 'active'
                    ? activeTotalCount
                    : activeTab === 'history'
                      ? historyList.length
                      : tagAndSearchTaskCount}
                </span>{' '}
                件
              </p>
              <button type="button" onClick={() => setSearchQuery('')} className="p-1 hover:bg-blue-100 rounded-md" aria-label="検索をクリア">
                <X size={16} />
              </button>
            </div>
          )}

          {activeTab === 'active' && (
            <>
              {taskFormExpanded ? (
                <form onSubmit={handleAddTask} className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Plus size={18} className="text-blue-500" /> 新規タスク
                    </span>
                    <button
                      type="button"
                      onClick={() => setTaskFormExpanded(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                      title="閉じる"
                    >
                      <ChevronUp size={18} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                      <span className="text-[10px] text-slate-500 leading-snug">改行で複数追加。カンマ区切りで日時指定可 (例: 買い物, 2024-05-01 15:00)</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const text = '以下のタスクリストを読み込み、それぞれのタスクを「タスク内容, YYYY-MM-DD HH:mm」の1行1タスク形式で出力してください。\n\n';
                          try {
                            await navigator.clipboard.writeText(text);
                            alert('AI用プロンプトの雛形をコピーしました！');
                          } catch {
                            alert('クリップボードへのコピーに失敗しました');
                          }
                        }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0 self-end sm:self-auto"
                      >
                        <Copy size={12} /> AI用プロンプト雛形をコピー
                      </button>
                    </div>
                    <textarea
                      placeholder="内容を入力..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      rows={3}
                      className="w-full py-2 px-3 outline-none text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 focus:bg-white resize-y text-sm"
                    />
                    <div className="flex justify-end">
                      <button type="submit" disabled={!newTaskTitle.trim() || loading} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-blue-700 transition shadow-sm">
                        追加
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Tag size={12} /> タグ:</span>
                    {newTaskTags.map(tag => (
                      <span key={tag} className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getTagColor(tag)}`}>
                        {tag}
                        <button type="button" onClick={() => setNewTaskTags(prev => prev.filter(t => t !== tag))} className="hover:text-red-500"><X size={12} /></button>
                      </span>
                    ))}
                    {tagStats.filter(t => t.tag !== '未分類' && !newTaskTags.includes(t.tag)).slice(0, 5).map(t => (
                      <button
                        key={`sug-${t.tag}`} type="button"
                        onClick={() => setNewTaskTags(prev => [...prev, t.tag])}
                        className="text-xs px-2 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
                      >
                        +{t.tag}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Calendar size={12} /> 期限(日時):
                    </label>
                    <input
                      type="datetime-local"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className="text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {newTaskDue && (
                      <button type="button" onClick={() => setNewTaskDue('')} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                        <X size={12} /> 期限クリア
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setHours(23, 59, 0, 0);
                        setNewTaskDue(toDatetimeLocalValue(d));
                      }}
                      className="text-xs px-2 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
                    >
                      今日中
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        d.setHours(23, 59, 0, 0);
                        setNewTaskDue(toDatetimeLocalValue(d));
                      }}
                      className="text-xs px-2 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
                    >
                      明日中
                    </button>
                    <span className="text-[10px] text-slate-400 w-full sm:w-auto sm:ml-auto">
                      ※ APIは期限の時刻を落とすことがあるため、時刻はメモ欄の [time:HH:mm] にも保存します
                    </span>
                  </div>
                </form>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOnlyNoDue(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 ${!showOnlyNoDue ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <Calendar size={14} /> 期限順ですべて
                </button>
                <button
                  onClick={() => setShowOnlyNoDue(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 ${showOnlyNoDue ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <CalendarOff size={14} /> 期限なしのみ
                </button>
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
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
            />
          )}
          {activeTab === 'calendar' && (
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
          {activeTab === 'routines' && (
            <RoutineDetectorView
              routineGroups={routineGroups}
              toggleTaskStatus={toggleTaskStatus}
              selectedTasks={selectedTasks}
              toggleSelection={toggleSelection}
              setSelectedTasks={setSelectedTasks}
              handleDeleteSelected={handleDeleteSelected}
              showCheckboxes={showCheckboxes}
              selectionMode={selectionMode}
              setSelectionMode={setSelectionMode}
            />
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
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/35 transition hover:bg-blue-700 hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 xl:bottom-8 xl:right-10"
          aria-expanded={taskFormExpanded}
        >
          {taskFormExpanded ? <X size={26} strokeWidth={2.25} /> : <Plus size={26} strokeWidth={2.25} />}
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
    tasks.filter(t => t.due && dueMatchesCalendarDay(t.due, dayDate));

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

  const displayedTasks = tasks.filter((t) => {
    if (!t.due) return false;
    const d = new Date(t.due);
    if (mode === 'month') return d.getFullYear() === y && d.getMonth() === m;
    return d >= weekStart && d < addWeeks(weekStart, 1);
  });

  const dTot = displayedTasks.length;
  const dComp = displayedTasks.filter((t) => t.status === 'completed').length;
  const dRate = dTot === 0 ? 0 : Math.round((dComp / dTot) * 100);

  const dTagData = {};
  displayedTasks.forEach((t) => {
    const tagList = t.tags.length === 0 ? ['未分類'] : t.tags;
    tagList.forEach((tag) => {
      if (!dTagData[tag]) dTagData[tag] = { t: 0, c: 0 };
      dTagData[tag].t++;
      if (t.status === 'completed') dTagData[tag].c++;
    });
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <button type="button" onClick={() => setMode('month')} className={`px-3 py-1.5 text-xs font-semibold transition ${mode === 'month' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>月表示</button>
            <button type="button" onClick={() => setMode('week')} className={`px-3 py-1.5 text-xs font-semibold transition ${mode === 'week' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>週表示</button>
          </div>
          <button type="button" onClick={() => setCursor(new Date())} className="text-xs font-medium text-violet-600 hover:underline px-2">今日へ</button>
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

      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
              <span>{mode === 'month' ? '今月の全体達成率' : '今週の全体達成率'}</span>
              <span>{dRate}% ({dComp}/{dTot})</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${dRate === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`} style={{ width: `${dRate}%` }} />
            </div>
          </div>
        </div>
        {Object.keys(dTagData).length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5 border-t border-slate-200">
            {Object.entries(dTagData).map(([tag, { t, c }]) => {
              const r = t === 0 ? 0 : Math.round((c / t) * 100);
              return (
                <div key={tag} className="flex flex-col w-[100px] sm:w-[120px]">
                  <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                    <span className="truncate pr-1">{tag}</span>
                    <span>{r}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1">
                    <div className={`h-1 rounded-full ${r === 100 ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${r}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-start cursor-pointer hover:border-blue-200 hover:shadow-md transition h-full"
    >
      <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
        {icon}{label}
      </p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-2xl font-bold ${accent}`}>{completed}</span>
        <span className="text-slate-400 text-lg font-semibold">/</span>
        <span className="text-lg font-semibold text-slate-600">{totalTarget}</span>
      </div>
      <div className="mt-2 w-full">
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${isEmpty ? 'bg-slate-200' : rate === 100 ? 'bg-emerald-400' : 'bg-blue-500'
              }`}
            style={{ width: `${isEmpty ? 0 : rate}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {isEmpty ? '対象タスクなし' : `達成率 ${rate}%`}
        </p>
      </div>
    </div>
  );
}

function RoutineDetectorView({
  routineGroups,
  toggleTaskStatus,
  selectedTasks,
  toggleSelection,
  setSelectedTasks,
  handleDeleteSelected,
  showCheckboxes,
  selectionMode,
  setSelectionMode,
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
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition border shrink-0 ${
              selectionMode
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {selectionMode ? '選択終了' : '選択モード'}
          </button>
          <span className="text-[10px] text-slate-400">Shiftキー長押しでも複数選択可</span>
        </div>
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
            <p>検出されたルーチンタスクはありません</p>
          </div>
        ) : (
          routineGroups.map((group, idx) => {
            const sortedTasks = [...group.tasks].sort((a, b) => {
              if (!a.due) return 1;
              if (!b.due) return -1;
              return new Date(a.due).getTime() - new Date(b.due).getTime();
            });

            return (
              <div key={group.title + String(idx)} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-base truncate flex-1 pr-4">{group.title}</h3>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">{group.count} 回出現</span>
                </div>
                <div className="p-3 bg-white flex justify-between items-center border-b border-slate-50">
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
                    className="text-xs text-blue-600 hover:underline"
                  >
                    このグループをすべて選択
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
                        className={`flex items-start gap-3 p-2 rounded-lg transition group ${
                          showCheckboxes ? 'cursor-pointer' : ''
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

function AnalyticsView({ tasks, weeklyHistory, monthlyHistory, yearlyHistory, overallCompletionRate, totalTasks, completedTasks, tagStats, selectedTag, toggleTaskStatus }) {
  const [granularity, setGranularity] = useState('week');
  const [expandedRow, setExpandedRow] = useState(null);
  const series = granularity === 'week' ? weeklyHistory : granularity === 'month' ? monthlyHistory : yearlyHistory;
  const maxRate = Math.max(100, ...series.map(w => w.rate));

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

  // Heatmap Data Processing
  const heatmap = useMemo(() => {
    const grid = Array(7).fill(0).map(() => Array(4).fill(0));
    tasks.forEach((t) => {
      if (t.status === 'completed' && t.completed) {
        const d = new Date(t.completed);
        const day = d.getDay();
        const hour = d.getHours();
        let timeSlot = 0;
        if (hour >= 6 && hour < 12) timeSlot = 1;
        else if (hour >= 12 && hour < 17) timeSlot = 2;
        else if (hour >= 17 && hour < 22) timeSlot = 3;
        grid[day][timeSlot] += 1;
      }
    });
    return grid;
  }, [tasks]);
  const maxHeat = Math.max(1, ...heatmap.flat());
  const timeLabels = ['深夜(0-6/22-24)', '朝(6-12)', '昼(12-17)', '夜(17-22)'];
  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  // Punctuality & Overdue Data
  const punctuality = useMemo(() => {
    let early = 0, onTime = 0, late = 0;
    tasks.forEach(t => {
      if (t.status === 'completed' && t.completed && t.due) {
        const c = new Date(t.completed).getTime();
        const d = new Date(t.due).getTime();
        if (c <= d - 86400000) early++;
        else if (c <= d + 86400000) onTime++;
        else late++;
      }
    });
    return { early, onTime, late, total: Math.max(early + onTime + late, 1) };
  }, [tasks]);

  const overdueList = tasks.filter((t) => t.status !== 'completed' && t.due && new Date(t.due).getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000).sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  const totalTagged = tagStats.reduce((sum, t) => sum + t.total, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-sm p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5"><Target size={16} /> 全体達成率 {scopeHint}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold">{overallCompletionRate}</span><span className="text-xl text-emerald-100">%</span>
            </div>
            <p className="text-sm text-emerald-100 mt-2">完了 {completedTasks} / 全体 {totalTasks}</p>
          </div>
          <Target className="absolute -right-4 -bottom-4 text-white opacity-10" size={120} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-500"/> 完了ペース (期限設定ありのタスク)</h3>
          <div className="flex w-full h-4 rounded-full overflow-hidden mb-3 bg-slate-100">
            <div className="bg-emerald-400" style={{ width: `${(punctuality.early / punctuality.total) * 100}%` }} title="期限前"></div>
            <div className="bg-blue-400" style={{ width: `${(punctuality.onTime / punctuality.total) * 100}%` }} title="当日"></div>
            <div className="bg-amber-400" style={{ width: `${(punctuality.late / punctuality.total) * 100}%` }} title="遅延"></div>
          </div>
          <div className="flex justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> 期限前 ({punctuality.early})</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> 当日 ({punctuality.onTime})</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> 遅延 ({punctuality.late})</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 size={18} className="text-indigo-600" /> 達成率推移</h3>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
            {[{ id: 'week', label: '週次' }, { id: 'month', label: '月次' }, { id: 'year', label: '年次' }].map(({ id, label }) => (
              <button key={id} onClick={() => setGranularity(id)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${granularity === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">{chartTitle}</p>
        <div className="flex items-end gap-1 sm:gap-2 h-52 px-1 sm:px-2 border-b border-slate-100 overflow-x-auto">
          {series.map(w => (
            <div key={w.key} className="flex-1 min-w-[28px] flex flex-col items-center justify-end gap-1">
              <span className={`text-[10px] sm:text-[11px] font-semibold ${w.total === 0 ? 'text-slate-300' : w.isFuture ? 'text-slate-400' : 'text-slate-600'}`}>{w.total === 0 ? '-' : `${w.rate}%`}</span>
              <div className={`w-full rounded-t-md transition-all ${w.isCurrent ? 'bg-gradient-to-t from-indigo-600 to-blue-500' : w.isFuture ? 'bg-gradient-to-t from-slate-300 to-slate-200 border border-dashed border-slate-300' : w.rate >= 80 ? 'bg-emerald-400' : w.rate >= 50 ? 'bg-blue-400' : w.rate > 0 ? 'bg-amber-400' : 'bg-slate-200'}`} style={{ height: `${(w.rate / maxRate) * 100}%`, minHeight: w.total === 0 ? '4px' : '8px' }} title={`${w.label}：完了 ${w.completed}/${w.total}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-2 px-1 sm:px-2 overflow-x-auto">
          {series.map(w => (<div key={`l-${w.key}`} className={`flex-1 min-w-[28px] text-[9px] sm:text-[10px] text-center truncate ${w.isCurrent ? 'text-indigo-600 font-semibold' : w.isFuture ? 'text-slate-400 italic' : 'text-slate-400'}`}>{labelFor(w)}</div>))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChart size={18} className="text-rose-500" /> リソース配分状況 (タグ別)</h3>
          <div className="space-y-4">
            {tagStats.slice(0, 8).map((tag) => (
              <div key={tag.tag}>
                <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                  <span>{tag.tag}</span>
                  <span>{Math.round((tag.total / totalTagged) * 100)}% ({tag.total}件)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-rose-400 h-2 rounded-full" style={{ width: `${(tag.total / totalTagged) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Flame size={18} className="text-orange-500" /> 集中度ヒートマップ (完了時間帯)</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[300px]">
              <div className="grid grid-cols-5 gap-1 mb-1">
                <div className="text-[10px] text-slate-400 text-center" />
                {timeLabels.map((l) => (<div key={l} className="text-[10px] text-slate-500 text-center">{l}</div>))}
              </div>
              {dayLabels.map((day, dIdx) => (
                <div key={day} className="grid grid-cols-5 gap-1 mb-1">
                  <div className="text-xs font-semibold text-slate-600 flex items-center justify-center">{day}</div>
                  {heatmap[dIdx].map((val, tIdx) => {
                    const intensity = val / maxHeat;
                    return (
                      <div key={`${dIdx}-${tIdx}`} className="h-8 rounded flex items-center justify-center text-[10px] text-white font-bold transition-all hover:scale-105" style={{ backgroundColor: `rgba(249, 115, 22, ${intensity === 0 ? 0.05 : 0.2 + intensity * 0.8})`, color: intensity > 0.4 ? 'white' : 'transparent' }} title={`${day}曜日 ${timeLabels[tIdx]}: ${val}件完了`}>
                        {val > 0 ? val : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
              <p className="text-[10px] text-slate-400 text-right mt-2">※過去の完了タイムスタンプに基づく</p>
            </div>
          </div>
        </div>

        <div className="col-span-full bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><AlertCircle size={18} className="text-red-500" /> 長期滞留アラート</h3>
          <p className="text-xs text-slate-500 mb-4">期限が過ぎてから3日以上長期間放置されているタスクです。</p>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {overdueList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">長期滞留しているタスクはありません🎉</p>
            ) : (
              overdueList.map((t) => (
                <div key={t.id} className="py-3 flex justify-between items-center gap-4">
                  <span className="text-sm font-medium text-slate-700 truncate">{t.cleanTitle}</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded whitespace-nowrap">
                    期限から {Math.floor((Date.now() - new Date(t.due).getTime()) / (1000 * 60 * 60 * 24))} 日経過
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* 既存の期間詳細テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
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
                                  .map(([tag, count]) => ({ tag, count, rate: Math.round((count / periodTaggedTotal) * 100) }))
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
