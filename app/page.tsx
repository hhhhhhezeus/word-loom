"use client";

import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type WordData = {
  id: string;
  original: string;
  lemma: string;
  phonetic: string;
  part: string;
  meaning: string;
  definition: string;
  example: string;
  tag: string;
  level: "new" | "learning" | "mastered";
  lastReviewed?: string;
  favorite?: boolean;
  reviewStage?: number;
  nextReviewOn?: string;
  addedAt?: string;
};

type ActivityEvent = { date: string; type: "collect" | "review" };
type ActivityStore = { dates: string[]; events?: ActivityEvent[] };

const irregular: Record<string, string> = {
  children: "child", men: "man", women: "woman", feet: "foot", teeth: "tooth",
  mice: "mouse", geese: "goose", went: "go", gone: "go", better: "good",
  best: "good", worse: "bad", worst: "bad", ran: "run", written: "write",
  wrote: "write", spoken: "speak", spoke: "speak", bought: "buy", brought: "bring",
  lying: "lie", dying: "die", tying: "tie", knives: "knife", leaves: "leaf",
};

const wordBook: Record<string, Omit<WordData, "id" | "original" | "level">> = {
  run: { lemma: "run", phonetic: "/rʌn/", part: "verb · 动词", meaning: "跑；运行；经营", definition: "to move quickly using your legs", example: "She runs along the river every morning.", tag: "日常生活" },
  explore: { lemma: "explore", phonetic: "/ɪkˈsplɔːr/", part: "verb · 动词", meaning: "探索；探究", definition: "to travel around a place to learn about it", example: "We spent the afternoon exploring the old town.", tag: "旅行见闻" },
  library: { lemma: "library", phonetic: "/ˈlaɪbreri/", part: "noun · 名词", meaning: "图书馆；资料库", definition: "a place where books and other materials are kept", example: "I found this novel in the local library.", tag: "阅读积累" },
  child: { lemma: "child", phonetic: "/tʃaɪld/", part: "noun · 名词", meaning: "儿童；孩子", definition: "a young person who is not yet an adult", example: "Every child learns at a different pace.", tag: "日常生活" },
  good: { lemma: "good", phonetic: "/ɡʊd/", part: "adjective · 形容词", meaning: "好的；优秀的；有益的", definition: "of a high quality or standard", example: "Reading is a good way to grow your vocabulary.", tag: "常用表达" },
  inspire: { lemma: "inspire", phonetic: "/ɪnˈspaɪər/", part: "verb · 动词", meaning: "启发；激励", definition: "to make someone feel that they want to do something", example: "Her story inspired me to keep learning.", tag: "阅读积累" },
};

const partNames: Record<string, string> = {
  noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词",
  pronoun: "代词", preposition: "介词", conjunction: "连词", interjection: "感叹词",
};

const tagNames: Record<string, string> = {
  noun: "名词积累", verb: "动作表达", adjective: "描述表达", adverb: "常用表达",
};

const initialWords: WordData[] = [];
const legacyDemoIds = new Set(["w1", "w2", "w3"]);

const wordsStorageKey = "wordloom-words";
const activityStorageKey = "wordloom-activity";

function getLocalDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDate(date);
}

function dateFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDate(date);
}

function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function countStreak(dates: string[]) {
  const days = new Set(dates);
  const cursor = new Date();
  if (!days.has(getLocalDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(getLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function persistLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or disabled storage should not break the rest of the app.
  }
}

function preferredPartFor(original: string) {
  const knownVerbForms = new Set(["went", "gone", "ran", "written", "wrote", "spoken", "spoke", "bought", "brought"]);
  if (knownVerbForms.has(original) || original.endsWith("ing") || original.endsWith("ed")) return "verb";
  if (original.endsWith("ies") || (original.endsWith("s") && !original.endsWith("ss"))) return "noun";
  return "";
}

function toLemma(value: string) {
  const word = value.toLowerCase().trim().replace(/[^a-z'-]/g, "");
  if (!word) return "";
  if (irregular[word]) return irregular[word];
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 5) {
    let base = word.slice(0, -3);
    if (/([b-df-hj-np-tv-z])\1$/.test(base)) base = base.slice(0, -1);
    if (["mak", "writ", "tak", "creat", "us"].includes(base)) base += "e";
    return base;
  }
  if (word.endsWith("ied") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ed") && word.length > 4) {
    let base = word.slice(0, -2);
    if (/([b-df-hj-np-tv-z])\1$/.test(base)) base = base.slice(0, -1);
    if (["inspir", "creat", "us", "mov"].includes(base)) base += "e";
    return base;
  }
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("uses") && !["buses", "gases"].includes(word)) return word.slice(0, -1);
  if (word.endsWith("es") && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function fallbackData(original: string, lemma: string): WordData {
  return {
    id: `${Date.now()}-${lemma}`,
    original,
    lemma,
    phonetic: "正在查询…",
    part: "word · 单词",
    meaning: "释义获取中",
    definition: "Connect to the dictionary to complete this entry.",
    example: `I came across the word “${lemma}” today.`,
    tag: "待整理",
    level: "new",
  };
}

export default function Home() {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<WordData>({ id: "preview", original: "running", ...wordBook.run, level: "new" });
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [filter, setFilter] = useState("全部单词");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [deletedWord, setDeletedWord] = useState<WordData | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activity, setActivity] = useState<ActivityStore>({ dates: [] });
  const [activeSection, setActiveSection] = useState("collect");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const savedWords = localStorage.getItem(wordsStorageKey);
      const savedActivity = localStorage.getItem(activityStorageKey);
      if (savedWords) {
        const parsedWords = JSON.parse(savedWords);
        if (Array.isArray(parsedWords)) setWords(parsedWords.filter((word: WordData) => !legacyDemoIds.has(word.id)));
      }
      if (savedActivity) {
        const parsedActivity = JSON.parse(savedActivity);
        if (Array.isArray(parsedActivity?.dates)) setActivity({ dates: parsedActivity.dates });
      }
    } catch {
      // A damaged local cache should never prevent the word book from opening.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(wordsStorageKey, JSON.stringify(words));
  }, [words, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(activityStorageKey, JSON.stringify(activity));
  }, [activity, hydrated]);

  useEffect(() => {
    const sections = ["collect", "wordbook", "review"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-25% 0px -60%", threshold: [0, 0.2, 0.6] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!reviewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setReviewOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [reviewOpen]);

  function recordActivity(type: ActivityEvent["type"] = "review") {
    const today = getLocalDate();
    setActivity((current) => {
      const nextActivity = {
        dates: current.dates.includes(today) ? current.dates : [...current.dates, today].slice(-365),
        events: [...(current.events || []), { date: today, type }].slice(-1200),
      };
      persistLocal(activityStorageKey, nextActivity);
      return nextActivity;
    });
  }

  async function analyzeWord(value: string) {
    const original = value.trim().toLowerCase();
    const lemma = toLemma(original);
    if (!lemma) return;
    setHasAnalyzed(true);
    setEditing(false);
    setLoading(true);
    const known = wordBook[lemma];
    if (known) {
      setAnalysis({ id: `${Date.now()}-${lemma}`, original, ...known, level: "new" });
      setLoading(false);
      return;
    }
    const pending = fallbackData(original, lemma);
    setAnalysis(pending);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lemma)}`);
      if (!response.ok) throw new Error("not found");
      const entries = await response.json();
      const entry = entries[0];
      const preferredPart = preferredPartFor(original);
      const sense = entry.meanings?.find((item: { partOfSpeech?: string }) => item.partOfSpeech === preferredPart) || entry.meanings?.[0];
      const detail = sense?.definitions?.[0];
      const definition = detail?.definition || "No definition available yet.";
      const part = sense?.partOfSpeech || "word";
      const baseResult: WordData = {
        ...pending,
        lemma: entry.word || lemma,
        phonetic: entry.phonetic || entry.phonetics?.find((item: { text?: string }) => item.text)?.text || "/—/",
        part: `${part} · ${partNames[part] || "词语"}`,
        meaning: definition,
        definition,
        example: detail?.example || `I learned how to use the word “${lemma}” today.`,
        tag: tagNames[part] || "日常积累",
      };
      setAnalysis(baseResult);
      setLoading(false);

      try {
        const translation = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(definition)}&langpair=en|zh-CN`);
        if (translation.ok) {
          const translated = await translation.json();
          if (translated.responseData?.translatedText) {
            const meaning = translated.responseData.translatedText;
            setAnalysis({ ...baseResult, meaning });
            setWords((current) => {
              const nextWords = current.map((word) => word.lemma === baseResult.lemma && word.meaning === definition ? { ...word, meaning } : word);
              persistLocal(wordsStorageKey, nextWords);
              return nextWords;
            });
          }
        }
      } catch {
        // The English definition remains useful when translation is unavailable.
      }
    } catch {
      setAnalysis({ ...pending, phonetic: "/—/", meaning: "暂未收录，可稍后补充中文释义" });
      setLoading(false);
    }
  }

  function analyze(e: FormEvent) {
    e.preventDefault();
    void analyzeWord(input);
  }

  function saveWord() {
    const existing = words.find((word) => word.lemma === analysis.lemma);
    let nextWords: WordData[];
    if (existing) {
      nextWords = words.map((word) => word.id === existing.id ? { ...analysis, id: existing.id, level: existing.level, favorite: existing.favorite, reviewStage: existing.reviewStage, nextReviewOn: existing.nextReviewOn, lastReviewed: existing.lastReviewed, addedAt: existing.addedAt } : word);
      setToast(`已更新 ${analysis.lemma}`);
    } else {
      nextWords = [{ ...analysis, id: `${Date.now()}-${analysis.lemma}`, addedAt: new Date().toISOString(), reviewStage: 0, nextReviewOn: getLocalDate() }, ...words];
      recordActivity("collect");
      setToast(`已把 ${analysis.lemma} 收进词库`);
    }
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    setTimeout(() => setToast(""), 2200);
  }

  function toggleFavorite(id: string) {
    const nextWords = words.map((word) => word.id === id ? { ...word, favorite: !word.favorite } : word);
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
  }

  function editSavedWord(word: WordData) {
    setAnalysis(word);
    setInput(word.original);
    setHasAnalyzed(true);
    setEditing(true);
    document.getElementById("collect")?.scrollIntoView({ behavior: "smooth" });
  }

  function exportBackup() {
    const payload = { version: 1, exportedAt: new Date().toISOString(), words, activity };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `word-loom-backup-${getLocalDate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast(`已导出 ${words.length} 个单词`);
    setTimeout(() => setToast(""), 1800);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!Array.isArray(backup.words)) throw new Error("invalid backup");
      const validWords = backup.words.filter((word: WordData) => word && typeof word.id === "string" && typeof word.lemma === "string" && typeof word.meaning === "string");
      const merged = new Map<string, WordData>();
      validWords.forEach((word: WordData) => merged.set(word.lemma.toLowerCase(), word));
      words.forEach((word) => merged.set(word.lemma.toLowerCase(), word));
      const nextWords = Array.from(merged.values());
      const importedDates = Array.isArray(backup.activity?.dates) ? backup.activity.dates.filter((date: unknown) => typeof date === "string") : [];
      const importedEvents = Array.isArray(backup.activity?.events)
        ? backup.activity.events.filter((event: ActivityEvent) => event && typeof event.date === "string" && ["collect", "review"].includes(event.type))
        : [];
      const nextActivity = {
        dates: Array.from(new Set([...activity.dates, ...importedDates])).slice(-365),
        events: [...(activity.events || []), ...importedEvents].slice(-1200),
      };
      setWords(nextWords);
      setActivity(nextActivity);
      persistLocal(wordsStorageKey, nextWords);
      persistLocal(activityStorageKey, nextActivity);
      setToast(`导入完成，词库现有 ${nextWords.length} 个单词`);
    } catch {
      setToast("备份文件无效，请选择拾词导出的 JSON 文件");
    }
    setTimeout(() => setToast(""), 2600);
  }

  function updateLevel(id: string) {
    const nextWords = words.map((word) => word.id === id ? { ...word, level: word.level === "mastered" ? "learning" as const : "mastered" as const, reviewStage: word.level === "mastered" ? 0 : word.reviewStage, nextReviewOn: word.level === "mastered" ? getLocalDate() : word.nextReviewOn } : word);
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    recordActivity("review");
  }

  function removeWord(id: string) {
    const removed = words.find((word) => word.id === id) || null;
    const nextWords = words.filter((word) => word.id !== id);
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    setDeletedWord(removed);
    setToast(removed ? `已移除 ${removed.lemma}` : "已从词库移除");
    setTimeout(() => { setToast(""); setDeletedWord(null); }, 4200);
  }

  function undoRemove() {
    if (!deletedWord) return;
    const nextWords = [deletedWord, ...words];
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    setDeletedWord(null);
    setToast(`已恢复 ${deletedWord.lemma}`);
    setTimeout(() => setToast(""), 1600);
  }

  function openReview() {
    const today = getLocalDate();
    const queue = words.filter((word) => word.level !== "mastered" && (!word.nextReviewOn || word.nextReviewOn <= today)).map((word) => word.id);
    if (!queue.length) {
      setToast("待复习单词已经清空啦");
      setTimeout(() => setToast(""), 1800);
      return;
    }
    setReviewQueue(queue);
    setReviewIndex(0);
    setRevealed(false);
    setReviewOpen(true);
  }

  function nextReview(mastered = false) {
    const currentId = reviewQueue[reviewIndex];
    const today = getLocalDate();
    const nextWords = words.map((word) => {
      if (word.id !== currentId) return word;
      const nextStage = mastered ? Math.min((word.reviewStage || 0) + 1, 3) : 0;
      const interval = mastered ? [1, 1, 3, 7][nextStage] : 1;
      return { ...word, level: mastered && nextStage >= 3 ? "mastered" as const : "learning" as const, reviewStage: nextStage, nextReviewOn: addDays(interval), lastReviewed: today };
    });
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    recordActivity("review");
    if (reviewIndex >= reviewQueue.length - 1) {
      setReviewOpen(false);
      setToast("今日复习完成，做得好！");
      setTimeout(() => setToast(""), 2200);
    } else {
      setReviewIndex((value) => value + 1);
      setRevealed(false);
    }
  }

  function speak(word: string) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(word));
    }
  }

  const filtered = useMemo(() => {
    let result = words;
    const today = getLocalDate();
    if (filter === "今日待复习") result = result.filter((word) => word.level !== "mastered" && (!word.nextReviewOn || word.nextReviewOn <= today));
    if (filter === "已掌握") result = result.filter((word) => word.level === "mastered");
    if (filter === "重点词") result = result.filter((word) => word.favorite);
    if (query.trim()) result = result.filter((word) => `${word.lemma} ${word.meaning} ${word.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
    return result;
  }, [filter, words, query]);

  const reviewed = words.filter((word) => word.lastReviewed === getLocalDate()).length;
  const streak = countStreak(activity.dates);
  const currentReview = words.find((word) => word.id === reviewQueue[reviewIndex]);
  const alreadySaved = hasAnalyzed && words.some((word) => word.lemma === analysis.lemma);
  const dueWords = words.filter((word) => word.level !== "mastered" && (!word.nextReviewOn || word.nextReviewOn <= getLocalDate()));
  const masteredCount = words.filter((word) => word.level === "mastered").length;
  const favoriteCount = words.filter((word) => word.favorite).length;
  const masteryRate = words.length ? Math.round((masteredCount / words.length) * 100) : 0;
  const learningCount = words.filter((word) => word.level === "learning").length;
  const newCount = words.length - masteredCount - learningCount;
  const stageSegments = [
    { label: "新收录", value: newCount, color: "#c9cec6" },
    { label: "学习中", value: learningCount, color: "#d99b65" },
    { label: "已掌握", value: masteredCount, color: "#789a7c" },
  ];
  const stageStops = (() => {
    if (!words.length) return "#e3e4de 0 100%";
    let start = 0;
    return stageSegments.map((segment) => {
      const end = start + (segment.value / words.length) * 100;
      const stop = `${segment.color} ${start}% ${end}%`;
      start = end;
      return stop;
    }).join(", ");
  })();
  const activityDays = Array.from({ length: 14 }, (_, index) => {
    const date = dateFromToday(index - 13);
    const events = activity.events?.filter((event) => event.date === date) || [];
    const legacyActive = activity.dates.includes(date);
    return {
      date,
      count: events.length || (legacyActive ? 1 : 0),
      collects: events.filter((event) => event.type === "collect").length,
      reviews: events.filter((event) => event.type === "review").length,
    };
  });
  const maxActivity = Math.max(1, ...activityDays.map((day) => day.count));
  const reviewForecast = Array.from({ length: 7 }, (_, index) => {
    const date = dateFromToday(index);
    return {
      date,
      count: words.filter((word) => word.level !== "mastered" && (index === 0
        ? (word.nextReviewOn || getLocalDate()) <= date
        : word.nextReviewOn === date)).length,
    };
  });
  const maxForecast = Math.max(1, ...reviewForecast.map((day) => day.count));
  const categoryCounts = Object.entries(words.reduce<Record<string, number>>((counts, word) => {
    counts[word.tag] = (counts[word.tag] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = Math.max(1, ...categoryCounts.map(([, count]) => count));

  if (!hydrated) {
    return <main className="app-loading" aria-label="正在读取本地词库"><div className="loading-brand"><span className="brand-mark">拾</span><b>拾词</b></div><div className="loading-thread"><i /><i /><i /></div><p>正在打开你的本地词库…</p></main>;
  }

  return (
    <main className="app-shell" id="top">
      {toast && <div className="toast" role="status">✓ {toast}{deletedWord && <button onClick={undoRemove}>撤销</button>}</div>}
      {reviewOpen && currentReview && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="单词复习" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false); }}>
          <div className="review-modal paper-card">
            <button className="modal-close" onClick={() => setReviewOpen(false)} aria-label="关闭">×</button>
            <div className="review-progress"><span>今日复习 · 记忆阶段 {Math.min((currentReview.reviewStage || 0) + 1, 3)} / 3</span><b>{reviewIndex + 1} / {reviewQueue.length}</b></div>
            <div className="progress-track"><i style={{ width: `${((reviewIndex + 1) / reviewQueue.length) * 100}%` }} /></div>
            <small>{revealed ? "你记对了吗？" : "看到这个词，你想起它的意思了吗？"}</small>
            <h2>{currentReview.lemma}</h2>
            <button className="modal-sound" onClick={() => speak(currentReview.lemma)}>))) {currentReview.phonetic}</button>
            {revealed ? <div className="review-answer"><h3>{currentReview.meaning}</h3><p>{currentReview.example}</p></div> : <button className="reveal-btn" autoFocus onClick={() => setRevealed(true)}>显示答案</button>}
            {revealed && <div className="review-actions"><button onClick={() => nextReview(false)}>还不熟 · 明天再练</button><button onClick={() => nextReview(true)}>记住了 · {["明天", "明天", "3 天后", "7 天后"][Math.min((currentReview.reviewStage || 0) + 1, 3)]} ✓</button></div>}
          </div>
        </div>
      )}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="拾词首页">
          <span className="brand-mark">拾</span>
          <span><b>拾词</b><small>Word Loom</small></span>
        </a>
        <nav aria-label="主导航">
          <a className={activeSection === "collect" ? "active" : ""} href="#collect">收词</a>
          <a className={activeSection === "wordbook" ? "active" : ""} href="#wordbook">词库</a>
          <a className={activeSection === "review" ? "active" : ""} href="#review">复习</a>
        </nav>
        <button className="streak" onClick={() => setToast(streak ? `已连续学习 ${streak} 天` : "完成一次收词或复习，即可点亮今天的连续学习")}>🔥 <b>{streak}</b> 天</button>
      </header>

      <section className="hero" id="collect">
        <div className="hero-copy">
          <span className="eyebrow"><i /> 今天，遇见了什么新词？</span>
          <h1>随手拾起，<br />让每个单词<span>留下来。</span></h1>
          <p>复制一个刚刚遇见的单词，剩下的整理工作交给拾词。</p>
        </div>
        <div className="date-note"><b>TODAY</b><strong>{words.length}</strong><span>你的词库<br /><em>{dueWords.length} 个今日待复习</em></span></div>
      </section>

      <section className="trust-strip" aria-label="产品特点"><span>✦ 自动还原单词原形</span><span>✦ 中英双语释义</span><span>✦ 浏览器本地保存</span><span>✦ 无需注册即可使用</span></section>

      <section className="collector-grid">
        <div className="input-card paper-card">
          <div className="card-label"><span>01</span> 粘贴单词</div>
          <form onSubmit={analyze}>
            <label htmlFor="word-input">输入英文单词</label>
            <div className="word-input-wrap">
              <input id="word-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="例如：exploring" autoComplete="off" />
              <button type="button" className="clear" onClick={() => setInput("")} aria-label="清空">×</button>
            </div>
            <div className="input-hint"><span>支持复数、过去式、-ing 等变形</span><kbd>Enter ↵</kbd></div>
            <button className="analyze-btn" type="submit" disabled={loading || !input.trim()}>
              <span>{loading ? "正在整理…" : "智能整理"}</span><b>→</b>
            </button>
            <div className="quick-words"><span>试一试</span>{["children", "written", "beautiful", "journeys"].map((word) => <button type="button" key={word} onClick={() => { setInput(word); void analyzeWord(word); }}>{word}</button>)}</div>
          </form>
          <div className="tip"><span>✦</span><p><b>小提示</b>你可以直接粘贴 <i>libraries</i>、<i>exploring</i>，拾词会自动还原原形。</p></div>
        </div>

        <article key={analysis.id} className={`result-card paper-card ${loading ? "is-loading" : ""}`} aria-live="polite">
          <div className="card-label"><span>02</span> 智能整理结果</div>
          {!hasAnalyzed ? <div className="result-empty"><span>abc</span><h3>等待一个新单词</h3><p>输入后，这里会自动整理原形、音标、词性、释义与例句。</p></div> : <>
          <div className="original-line">你输入了 <del>{analysis.original}</del>{analysis.original !== analysis.lemma && <span>已还原原形 ✓</span>}</div>
          <div className="word-heading">
            <div><h2>{analysis.lemma}</h2><p>{analysis.phonetic}</p></div>
            <button className="sound" onClick={() => speak(analysis.lemma)} aria-label={`朗读 ${analysis.lemma}`}>)))</button>
          </div>
          <span className="part-badge">{analysis.part}</span>
          <div className="meaning-block"><small>核心释义</small>{editing ? <textarea aria-label="编辑释义" value={analysis.meaning} onChange={(e) => setAnalysis({ ...analysis, meaning: e.target.value })} /> : <h3>{analysis.meaning}</h3>}<p>{analysis.definition}</p></div>
          {editing ? <textarea className="example-editor" aria-label="编辑例句" value={analysis.example} onChange={(e) => setAnalysis({ ...analysis, example: e.target.value })} /> : <blockquote>“{analysis.example}”<small>例句 · Example</small></blockquote>}
          <div className="result-footer"><span>⌁ {analysis.tag}</span><div><button onClick={() => setEditing(!editing)}>{editing ? "完成编辑" : "✎ 编辑"}</button><button className="save-word" onClick={saveWord} disabled={loading}>{alreadySaved ? "✓ 保存修改" : "＋ 收入词库"}</button></div></div>
          </>}
        </article>
      </section>

      <section className="library" id="wordbook">
        <div className="section-title">
          <div><span className="eyebrow"><i /> MY WORD GARDEN</span><h2>我的词库</h2></div>
          <p>已经拾起 <b>{words.length}</b> 个单词 · 今天复习 <b>{reviewed}</b> 个</p>
        </div>
        <div className="stats-grid" aria-label="学习统计">
          <div><span>今日待复习</span><b>{dueWords.length}</b><small>Due today</small></div>
          <div><span>已经掌握</span><b>{masteredCount}</b><small>Mastered</small></div>
          <div><span>重点词</span><b>{favoriteCount}</b><small>Favorites</small></div>
          <div className="mastery-stat"><span>掌握进度</span><b>{masteryRate}%</b><i><em style={{ width: `${masteryRate}%` }} /></i></div>
        </div>
        <section className="insights" aria-labelledby="insights-title">
          <div className="insights-heading">
            <div><span className="eyebrow"><i /> LEARNING INSIGHTS</span><h3 id="insights-title">学习图谱</h3></div>
            <p>图表来自这台设备上的学习记录</p>
          </div>
          <div className="insights-grid">
            <article className="viz-card activity-viz">
              <header><div><b>近 14 天节奏</b><span>每天的收词与复习次数</span></div><strong>{activityDays.reduce((sum, day) => sum + day.count, 0)}</strong></header>
              <div className="activity-chart" role="img" aria-label={`近十四天共学习 ${activityDays.reduce((sum, day) => sum + day.count, 0)} 次`}>
                {activityDays.map((day, index) => (
                  <div className="activity-column" key={day.date}>
                    <span className="bar-value">{day.count || ""}</span>
                    <i style={{ height: `${day.count ? Math.max(12, (day.count / maxActivity) * 100) : 3}%` }} data-empty={!day.count} title={`${day.date}：${day.count} 次${day.collects || day.reviews ? `（收词 ${day.collects}，复习 ${day.reviews}）` : "（历史学习记录）"}`} />
                    <small>{index % 3 === 1 || index === 13 ? shortDate(day.date) : ""}</small>
                  </div>
                ))}
              </div>
              <div className="viz-legend"><span><i className="legend-study" />学习行为</span><em>柱越高，当天练习越多</em></div>
            </article>

            <article className="viz-card stage-viz">
              <header><div><b>记忆阶段</b><span>词库当前掌握构成</span></div></header>
              <div className="donut-wrap">
                <div className="donut" style={{ background: `conic-gradient(${stageStops})` }} role="img" aria-label={`新收录 ${newCount}，学习中 ${learningCount}，已掌握 ${masteredCount}`}>
                  <span><b>{masteryRate}%</b><small>掌握率</small></span>
                </div>
                <div className="stage-legend">
                  {stageSegments.map((segment) => <p key={segment.label}><i style={{ background: segment.color }} /><span>{segment.label}</span><b>{segment.value}</b></p>)}
                </div>
              </div>
            </article>

            <article className="viz-card forecast-viz">
              <header><div><b>未来 7 天</b><span>计划中的复习负担</span></div><strong>{reviewForecast.reduce((sum, day) => sum + day.count, 0)}</strong></header>
              <div className="forecast-chart" role="img" aria-label={`未来七天计划复习 ${reviewForecast.reduce((sum, day) => sum + day.count, 0)} 个单词`}>
                {reviewForecast.map((day, index) => <div key={day.date}><b>{day.count}</b><span style={{ height: `${day.count ? Math.max(10, (day.count / maxForecast) * 100) : 2}%` }} title={`${day.date}：${day.count} 个`} /><small>{index === 0 ? "今天" : shortDate(day.date)}</small></div>)}
              </div>
            </article>

            <article className="viz-card category-viz">
              <header><div><b>分类分布</b><span>最常积累的内容方向</span></div></header>
              {categoryCounts.length ? <div className="category-chart">
                {categoryCounts.map(([tag, count]) => <div key={tag}><p><span>{tag}</span><b>{count}</b></p><i><em style={{ width: `${(count / maxCategory) * 100}%` }} /></i></div>)}
              </div> : <div className="viz-empty">收进第一个单词后，这里会长出你的分类图谱。</div>}
            </article>
          </div>
        </section>
        <div className="data-toolbar">
          <p>数据仅保存在当前浏览器，建议定期备份。</p>
          <div><button onClick={exportBackup}>⇩ 导出备份</button><button onClick={() => importRef.current?.click()}>⇧ 导入备份</button><input ref={importRef} type="file" accept="application/json,.json" onChange={importBackup} aria-label="选择拾词备份文件" /></div>
        </div>
        <div className="filter-row" role="group" aria-label="筛选单词">
          {["全部单词", "今日待复习", "重点词", "已掌握"].map((name) => <button key={name} className={filter === name ? "selected" : ""} onClick={() => setFilter(name)}>{name}{name === "全部单词" && ` ${words.length}`}</button>)}
          {searching && <input className="library-search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="搜索单词、释义或分类" aria-label="搜索词库" />}
          <button className="search-btn" onClick={() => { setSearching(!searching); if (searching) setQuery(""); }} aria-label="搜索词库">{searching ? "×" : "⌕"}</button>
        </div>
        <div className="word-list">
          {filtered.map((word, index) => (
            <article className="word-row" key={word.id} style={{ "--row-delay": `${Math.min(index, 8) * 45}ms` } as CSSProperties}>
              <span className={`level-dot ${word.level}`} />
              <div className="word-main"><small>{String(index + 1).padStart(2, "0")}</small><button className="word-edit" onClick={() => editSavedWord(word)} aria-label={`编辑 ${word.lemma}`}><h3>{word.lemma}</h3><p>{word.phonetic} · {word.part.split(" · ")[0]}</p></button></div>
              <div className="row-meaning"><b>{word.meaning}</b><span>原词：{word.original} · {word.level === "mastered" ? "已掌握" : `下次复习：${word.nextReviewOn || "今天"}`}</span></div>
              <span className="tag">{word.tag}</span>
              <button className={`favorite-btn ${word.favorite ? "done" : ""}`} onClick={() => toggleFavorite(word.id)} aria-label={word.favorite ? `取消重点 ${word.lemma}` : `标为重点 ${word.lemma}`}>{word.favorite ? "★" : "☆"}</button>
              <button className={`master-btn ${word.level === "mastered" ? "done" : ""}`} onClick={() => updateLevel(word.id)} aria-label={word.level === "mastered" ? "标记为学习中" : "标记为已掌握"}>✓</button>
              <button className="row-sound" onClick={() => speak(word.lemma)} aria-label={`朗读 ${word.lemma}`}>)))</button>
              <button className="delete-btn" onClick={() => removeWord(word.id)} aria-label={`删除 ${word.lemma}`}>×</button>
            </article>
          ))}
          {filtered.length === 0 && <div className="empty">这里还没有单词，去拾起一个吧。</div>}
        </div>
      </section>

      <section className="review-banner" id="review">
        <div className="review-icon">↻</div><div><span>SPACED REVIEW</span><h2>今天还有 {dueWords.length} 个单词等待复习</h2><p>连续记住三次，按 1、3、7 天逐步拉开复习间隔。</p></div>
        <button onClick={openReview} disabled={!dueWords.length}>开始今日复习 <b>→</b></button>
      </section>
      <footer><span>拾词 WORD LOOM</span><p>把偶遇的单词，织成自己的语言。</p><small>每一次遇见，都值得被记住 ✦</small></footer>
    </main>
  );
}
