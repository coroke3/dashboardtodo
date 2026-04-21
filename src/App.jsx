import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2, Circle, AlertCircle, Play, Tag, LogOut,
  RefreshCw, LayoutDashboard, ListTodo, Calendar,
  Plus, X, History, Target, TrendingUp, BarChart3, CalendarOff,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown
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
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const w = WEEKDAYS[d.getDay()];
  const hh = d.getHours();
  const mi = d.getMinutes();
  const hasTime = hh !== 0 || mi !== 0;
  if (hasTime) {
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

/** アクティブ並び: 0期限切れ 1今日 2今週(今日以外) 3来週 4その他 5期限なし */
const getActiveSortKey = (task, now, weekStart, weekEnd, nextWeekStart, nextWeekEnd) => {
  if (!task.due) return { bucket: 5, dueMs: Number.POSITIVE_INFINITY };
  const due = new Date(task.due);
  const dueMs = due.getTime();
  if (isOverdue(task.due)) return { bucket: 0, dueMs };
  if (sameLocalDay(due, now)) return { bucket: 1, dueMs };
  if (due >= weekStart && due < weekEnd) return { bucket: 2, dueMs };
  if (due >= nextWeekStart && due < nextWeekEnd) return { bucket: 3, dueMs };
  return { bucket: 4, dueMs };
};

const ACTIVE_SECTION_TITLES = [
  '期限切れ',
  '今日',
  '今週（今日以外）',
  '来週',
  'その他（期限あり・時系列）',
  '期限なし',
];

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
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'analytics' | 'calendar'
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTags, setNewTaskTags] = useState([]);
  const [newTaskDue, setNewTaskDue] = useState('');
  const [showOnlyNoDue, setShowOnlyNoDue] = useState(false);
  const [taskFormExpanded, setTaskFormExpanded] = useState(false);
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());

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
      if (stored && stored.expiresAt > Date.now() + 30_000) return;
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
    return { ...task, tags, platforms, cleanTitle: cleanTitle || '（タイトルなし）' };
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
    setAccessToken(null);
    setTasks([]);
    setIsDemo(false);
    setSelectedTag(null);
    silentAuthTried.current = false;
  };

  const handleRefresh = () => {
    if (isDemo) loadDemo();
    else if (accessToken) fetchRealTasks(accessToken);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const prefix = newTaskTags.map(t => `[${t}]`).join('');
    const fullTitle = prefix ? `${prefix} ${newTaskTitle}` : newTaskTitle;
    const dueIso = newTaskDue ? new Date(newTaskDue).toISOString() : undefined;

    setLoading(true);
    if (isDemo) {
      const newTask = parseTask({
        id: `demo-${Date.now()}`,
        listId: "demo",
        title: fullTitle,
        status: "needsAction",
        due: dueIso,
        updated: new Date().toISOString()
      });
      setTasks([newTask, ...tasks]);
      setNewTaskTitle('');
      setNewTaskTags([]);
      setNewTaskDue('');
      setTaskFormExpanded(false);
      setLoading(false);
      return;
    }

    try {
      const body = { title: fullTitle };
      if (dueIso) body.due = dueIso;
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const addedTask = parseTask({ ...data, listId: '@default' });
      setTasks([addedTask, ...tasks]);
      setNewTaskTitle('');
      setNewTaskTags([]);
      setNewTaskDue('');
      setTaskFormExpanded(false);
    } catch {
      alert("タスクの追加に失敗しました");
    } finally {
      setLoading(false);
    }
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
  const { stats, tagStats, weeklyStats, nextWeekStats, monthStats, weeklyHistory, monthlyHistory, yearlyHistory, overallCompletionRate } = useMemo(() => {
    const tagData = {};
    let total = tasks.length;
    let completed = 0;

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(now);
    const nextWeekStart = addWeeks(weekStart, 1);
    const nextWeekEnd = addWeeks(weekStart, 2);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let weekTotal = 0, weekCompleted = 0;
    let nextWeekTotal = 0, nextWeekCompleted = 0;
    let monthTotal = 0, monthCompleted = 0;

    const initTagData = (tag) => {
      if (!tagData[tag]) tagData[tag] = { total: 0, completed: 0 };
    };

    tasks.forEach(t => {
      const isCompleted = t.status === 'completed';
      if (isCompleted) completed++;

      const dueDate = t.due ? new Date(t.due) : null;
      if (dueDate) {
        if (dueDate >= weekStart && dueDate < weekEnd) {
          weekTotal++;
          if (isCompleted) weekCompleted++;
        }
        if (dueDate >= nextWeekStart && dueDate < nextWeekEnd) {
          nextWeekTotal++;
          if (isCompleted) nextWeekCompleted++;
        }
        if (dueDate >= monthStart && dueDate < monthEnd) {
          monthTotal++;
          if (isCompleted) monthCompleted++;
        }
      }

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
      tasks.forEach(t => {
        if (!t.due) return;
        const d = new Date(t.due);
        if (d >= weekStartN && d < weekEndN) {
          wTotal++;
          if (t.status === 'completed') wDone++;
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
      });
    }

    const overall = total === 0 ? 0 : Math.round((completed / total) * 100);

    const monthlyHistory = [];
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const mEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      let mt = 0, mc = 0;
      tasks.forEach(t => {
        if (!t.due) return;
        const d = new Date(t.due);
        if (d >= mStart && d < mEnd) {
          mt++;
          if (t.status === 'completed') mc++;
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
      });
    }

    const yearlyHistory = [];
    const cy = now.getFullYear();
    for (let y = cy - 4; y <= cy; y++) {
      const yStart = new Date(y, 0, 1);
      const yEnd = new Date(y + 1, 0, 1);
      let yt = 0, yc = 0;
      tasks.forEach(t => {
        if (!t.due) return;
        const d = new Date(t.due);
        if (d >= yStart && d < yEnd) {
          yt++;
          if (t.status === 'completed') yc++;
        }
      });
      yearlyHistory.push({
        key: String(y),
        label: `${y}年`,
        total: yt,
        completed: yc,
        rate: yt === 0 ? 0 : Math.round((yc / yt) * 100),
        isCurrent: y === cy,
      });
    }

    return {
      stats: { total, completed, active: total - completed },
      tagStats: tagStatsList,
      weeklyStats: {
        rate: weekTotal === 0 ? 0 : Math.round((weekCompleted / weekTotal) * 100),
        completed: weekCompleted,
        totalTarget: weekTotal,
      },
      nextWeekStats: {
        rate: nextWeekTotal === 0 ? 0 : Math.round((nextWeekCompleted / nextWeekTotal) * 100),
        completed: nextWeekCompleted,
        totalTarget: nextWeekTotal,
      },
      monthStats: {
        rate: monthTotal === 0 ? 0 : Math.round((monthCompleted / monthTotal) * 100),
        completed: monthCompleted,
        totalTarget: monthTotal,
      },
      weeklyHistory: history,
      monthlyHistory,
      yearlyHistory,
      overallCompletionRate: overall,
    };
  }, [tasks]);

  // === フィルター & ソート ===
  const { activeGroups, activeTotalCount, historyList } = useMemo(() => {
    let filtered = tasks;
    if (selectedTag) {
      filtered = selectedTag === '未分類'
        ? tasks.filter(t => t.tags.length === 0)
        : tasks.filter(t => t.tags.includes(selectedTag));
    }

    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekRange(now);
    const nextWeekStart = addWeeks(weekStart, 1);
    const nextWeekEnd = addWeeks(weekStart, 2);

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

    const buckets = ACTIVE_SECTION_TITLES.map((title, bucket) => ({ bucket, title, tasks: [] }));
    active.forEach(task => {
      const { bucket } = getActiveSortKey(task, now, weekStart, weekEnd, nextWeekStart, nextWeekEnd);
      buckets[bucket].tasks.push(task);
    });
    buckets.forEach(b => {
      b.tasks.sort((a, c) => {
        const ka = getActiveSortKey(a, now, weekStart, weekEnd, nextWeekStart, nextWeekEnd);
        const kc = getActiveSortKey(c, now, weekStart, weekEnd, nextWeekStart, nextWeekEnd);
        return ka.dueMs - kc.dueMs;
      });
    });
    const activeGroups = buckets.filter(b => b.tasks.length > 0);
    const activeTotalCount = activeGroups.reduce((n, g) => n + g.tasks.length, 0);

    const history = filtered
      .filter(t => t.status === 'completed')
      .sort((a, b) => new Date(b.completed || 0) - new Date(a.completed || 0));

    return { activeGroups, activeTotalCount, historyList: history };
  }, [tasks, selectedTag, showOnlyNoDue]);

  const calendarTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedTag) {
      filtered = selectedTag === '未分類'
        ? tasks.filter(t => t.tags.length === 0)
        : tasks.filter(t => t.tags.includes(selectedTag));
    }
    return filtered;
  }, [tasks, selectedTag]);

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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="text-blue-600" size={24} />
            <h1 className="font-bold text-lg hidden sm:block">Task Dashboard</h1>
            {isDemo && <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">DEMO</span>}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-50"
              title="更新"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">切断</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-xl shadow-sm text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-100 text-sm font-medium mb-1 flex items-center gap-1.5"><TrendingUp size={16} /> 今週の達成率</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{weeklyStats.rate}</span>
                <span className="text-lg text-blue-200">%</span>
              </div>
              <p className="text-xs text-blue-200 mt-2">
                {weeklyStats.totalTarget === 0
                  ? '今週期限のタスクはありません'
                  : `完了 ${weeklyStats.completed} / 今週期限 ${weeklyStats.totalTarget}`}
              </p>
            </div>
            <Target className="absolute -right-4 -bottom-4 text-white opacity-10" size={100} />
          </div>

          <PeriodCard
            label="今週のタスク"
            icon={<Calendar size={16} />}
            stats={weeklyStats}
            accent="text-blue-600"
          />
          <PeriodCard
            label="来週のタスク"
            icon={<Calendar size={16} />}
            stats={nextWeekStats}
            accent="text-indigo-600"
          />
          <PeriodCard
            label="今月のタスク"
            icon={<Calendar size={16} />}
            stats={monthStats}
            accent="text-emerald-600"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sticky top-24">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
                <Tag size={16} /> Tags & Progress
              </h2>
              <div className="flex flex-row md:flex-col flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition ${
                    selectedTag === null ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  すべてのタスク ({stats.total})
                </button>
                {tagStats.map((tagData) => (
                  <button
                    key={tagData.tag}
                    onClick={() => setSelectedTag(tagData.tag)}
                    className={`p-3 rounded-lg text-sm font-medium text-left transition flex flex-col gap-1.5 ${
                      selectedTag === tagData.tag
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${tagData.tag === '未分類' ? 'bg-slate-300' : getTagColor(tagData.tag).split(' ')[0]}`}></span>
                        <span className="truncate max-w-[120px]">{tagData.tag}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedTag === tagData.tag ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        {tagData.active > 0 ? tagData.active : '✓'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/70 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all duration-500 ${tagData.rate === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`} style={{ width: `${tagData.rate}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>完了: {tagData.completed}/{tagData.total}</span>
                      <span className="font-semibold">{tagData.rate}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-grow min-w-0 space-y-4">
            <div className="flex flex-wrap gap-2 p-1 bg-slate-200/60 rounded-lg w-full">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${activeTab === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Circle size={16} /> アクティブ
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <History size={16} /> 履歴
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${activeTab === 'calendar' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Calendar size={16} /> カレンダー
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${activeTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <BarChart3 size={16} /> 分析
              </button>
            </div>

            {activeTab === 'active' && (
              <>
                {!taskFormExpanded ? (
                  <button
                    type="button"
                    onClick={() => setTaskFormExpanded(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600 transition"
                  >
                    <Plus size={18} className="text-blue-500" />
                    タスクを追加
                    <ChevronDown size={16} className="text-slate-400" />
                  </button>
                ) : (
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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <input
                        type="text"
                        placeholder="内容を入力... (Enterで追加)"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="flex-grow w-full py-2 px-1 outline-none text-slate-800 placeholder-slate-400 bg-transparent border-b border-slate-200 focus:border-blue-500"
                      />
                      <button type="submit" disabled={!newTaskTitle.trim() || loading} className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-blue-700 transition">
                        追加
                      </button>
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
                        ※ Google Tasks APIは時刻部分を保持しない場合があります
                      </span>
                    </div>
                  </form>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowOnlyNoDue(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 ${
                      !showOnlyNoDue ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar size={14} /> 期限順ですべて
                  </button>
                  <button
                    onClick={() => setShowOnlyNoDue(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition flex items-center gap-1.5 ${
                      showOnlyNoDue ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CalendarOff size={14} /> 期限なしのみ
                  </button>
                </div>
              </>
            )}

            {activeTab === 'analytics' ? (
              <AnalyticsView
                weeklyHistory={weeklyHistory}
                monthlyHistory={monthlyHistory}
                yearlyHistory={yearlyHistory}
                overallCompletionRate={overallCompletionRate}
                totalTasks={stats.total}
                completedTasks={stats.completed}
                tagStats={tagStats}
              />
            ) : activeTab === 'calendar' ? (
              <CalendarView
                tasks={calendarTasks}
                mode={calendarMode}
                setMode={setCalendarMode}
                cursor={calendarCursor}
                setCursor={setCalendarCursor}
                toggleTaskStatus={toggleTaskStatus}
                getTagColor={getTagColor}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    {selectedTag ? (
                      <><span className="text-slate-400">#</span> {selectedTag}</>
                    ) : (activeTab === 'active'
                      ? (showOnlyNoDue ? '期限なしのアクティブタスク' : 'アクティブタスク（時系列・見出し別）')
                      : 'すべての完了履歴')}
                  </h2>
                  <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                    {activeTab === 'active' ? activeTotalCount : historyList.length} 件
                  </span>
                </div>

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
                        <div className="sticky top-16 z-[5] px-4 py-2.5 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200/80 flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-800">{group.title}</h3>
                          <span className="text-[11px] font-medium text-slate-500 tabular-nums">{group.tasks.length} 件</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {group.tasks.map(task => {
                            const overdue = task.status !== 'completed' && isOverdue(task.due);
                            return (
                              <div
                                key={task.id}
                                className={`p-4 flex items-start gap-3 transition group ${
                                  overdue
                                    ? 'bg-red-50/40 hover:bg-red-50 border-l-4 border-red-400'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <button
                                  onClick={() => toggleTaskStatus(task)}
                                  className="mt-0.5 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                                >
                                  <Circle className={`${overdue ? 'text-red-400 group-hover:text-red-500' : 'text-slate-300 group-hover:text-blue-500'} transition`} size={22} />
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
                                      <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                        overdue
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
                      return (
                      <div
                        key={task.id}
                        className={`p-4 flex items-start gap-3 transition group ${
                          task.status === 'completed'
                            ? 'opacity-70 bg-slate-50/50 hover:bg-slate-50'
                            : overdue
                              ? 'bg-red-50/40 hover:bg-red-50 border-l-4 border-red-400'
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          onClick={() => toggleTaskStatus(task)}
                          className="mt-0.5 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                        >
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="text-emerald-500 hover:text-emerald-600 transition" size={22} />
                          ) : (
                            <Circle className={`${overdue ? 'text-red-400 group-hover:text-red-500' : 'text-slate-300 group-hover:text-blue-500'} transition`} size={22} />
                          )}
                        </button>

                        <div className="flex-grow min-w-0">
                          <h3 className={`font-medium text-base mb-1.5 whitespace-normal break-words ${
                            task.status === 'completed'
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
                              <div className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                overdue
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
                    );})}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
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

function PeriodCard({ label, icon, stats, accent }) {
  const { completed, totalTarget, rate } = stats;
  const isEmpty = totalTarget === 0;
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-start">
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
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isEmpty ? 'bg-slate-200' : rate === 100 ? 'bg-emerald-400' : 'bg-blue-500'
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

function AnalyticsView({ weeklyHistory, monthlyHistory, yearlyHistory, overallCompletionRate, totalTasks, completedTasks, tagStats }) {
  const [granularity, setGranularity] = useState('week');
  const series = granularity === 'week' ? weeklyHistory : granularity === 'month' ? monthlyHistory : yearlyHistory;
  const maxRate = Math.max(100, ...series.map(w => w.rate));

  const chartTitle =
    granularity === 'week' ? '週次（過去7週＋今週＋来週）'
      : granularity === 'month' ? '月次（過去12ヶ月）'
        : '年次（過去5年）';
  const chartHint =
    granularity === 'week' ? '期限日が含まれる週のタスクを集計'
      : granularity === 'month' ? '期限日が含まれる月のタスクを集計'
        : '期限日が含まれる年のタスクを集計';

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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-600" /> 達成率推移
          </h2>
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'week', label: '週次' },
              { id: 'month', label: '月次' },
              { id: 'year', label: '年次' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setGranularity(id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  granularity === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">{chartTitle} — {chartHint}</p>

        <div className="flex items-end gap-1 sm:gap-2 h-52 px-1 sm:px-2 border-b border-slate-100 overflow-x-auto">
          {series.map(w => (
            <div key={w.key} className="flex-1 min-w-[28px] flex flex-col items-center justify-end gap-1">
              <span className={`text-[10px] sm:text-[11px] font-semibold ${w.total === 0 ? 'text-slate-300' : w.isFuture ? 'text-slate-400' : 'text-slate-600'}`}>
                {w.total === 0 ? '-' : `${w.rate}%`}
              </span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  w.isCurrent
                    ? 'bg-gradient-to-t from-indigo-600 to-blue-500'
                    : w.isFuture
                      ? 'bg-gradient-to-t from-slate-300 to-slate-200 border border-dashed border-slate-300'
                      : w.rate >= 80 ? 'bg-emerald-400'
                        : w.rate >= 50 ? 'bg-blue-400'
                          : w.rate > 0 ? 'bg-amber-400'
                            : 'bg-slate-200'
                }`}
                style={{ height: `${(w.rate / maxRate) * 100}%`, minHeight: w.total === 0 ? '4px' : '8px' }}
                title={`${w.label}：完了 ${w.completed}/${w.total}`}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-2 px-1 sm:px-2 overflow-x-auto">
          {series.map(w => (
            <div key={`l-${w.key}`} className={`flex-1 min-w-[28px] text-[9px] sm:text-[10px] text-center truncate ${w.isCurrent ? 'text-indigo-600 font-semibold' : w.isFuture ? 'text-slate-400 italic' : 'text-slate-400'}`}>
              {labelFor(w)}
            </div>
          ))}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-1 px-1 sm:px-2 overflow-x-auto">
          {series.map(w => (
            <div key={`n-${w.key}`} className="flex-1 min-w-[28px] text-[9px] sm:text-[10px] text-center text-slate-400 truncate">
              {w.completed}/{w.total}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-sm p-5 text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
              <Target size={16} /> 全体の達成率
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{overallCompletionRate}</span>
              <span className="text-lg text-emerald-100">%</span>
            </div>
            <p className="text-xs text-emerald-100 mt-2">完了 {completedTasks} / 全体 {totalTasks}</p>
          </div>
          <Target className="absolute -right-4 -bottom-4 text-white opacity-10" size={100} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <Tag size={16} className="text-blue-600" /> タグ別 完了率 TOP5
          </p>
          <div className="space-y-2.5">
            {tagStats.slice(0, 5).map(t => (
              <div key={`a-${t.tag}`}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span className="truncate max-w-[140px]">{t.tag}</span>
                  <span className="font-semibold">{t.rate}% <span className="text-slate-400 font-normal">({t.completed}/{t.total})</span></span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${t.rate === 100 ? 'bg-emerald-400' : 'bg-blue-500'}`}
                    style={{ width: `${t.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {tagStats.length === 0 && (
              <p className="text-xs text-slate-400">集計対象がまだありません</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">
          {granularity === 'week' ? '週次' : granularity === 'month' ? '月次' : '年次'}の詳細
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
              {series.slice().reverse().map(w => (
                <tr key={`t-${w.key}`} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">
                    {granularity === 'week' && w.isCurrent
                      ? <span className="font-semibold text-indigo-600">今週 <span className="text-slate-400 font-normal">({w.label})</span></span>
                      : granularity === 'week' && w.isFuture
                        ? <span className="text-slate-500">来週 <span className="text-slate-400">({w.label})</span></span>
                        : w.label}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{w.total}</td>
                  <td className="py-2 pr-4 text-slate-600">{w.completed}</td>
                  <td className="py-2 pr-4 font-semibold">
                    <span className={w.total === 0 ? 'text-slate-300' : w.rate >= 80 ? 'text-emerald-600' : w.rate >= 50 ? 'text-blue-600' : 'text-amber-600'}>
                      {w.total === 0 ? '-' : `${w.rate}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
