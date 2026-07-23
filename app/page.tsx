"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";

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
};

type ActivityStore = { dates: string[] };

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

  function recordActivity() {
    const today = getLocalDate();
    const nextActivity = activity.dates.includes(today) ? activity : { dates: [...activity.dates, today].slice(-365) };
    setActivity(nextActivity);
    persistLocal(activityStorageKey, nextActivity);
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
    if (words.some((word) => word.lemma === analysis.lemma)) {
      setToast("这个单词已经在词库里啦");
    } else {
      const nextWords = [{ ...analysis, id: `${Date.now()}-${analysis.lemma}` }, ...words];
      setWords(nextWords);
      persistLocal(wordsStorageKey, nextWords);
      recordActivity();
      setToast(`已把 ${analysis.lemma} 收进词库`);
    }
    setTimeout(() => setToast(""), 2200);
  }

  function updateLevel(id: string) {
    const nextWords = words.map((word) => word.id === id ? { ...word, level: word.level === "mastered" ? "learning" as const : "mastered" as const } : word);
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    recordActivity();
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
    const queue = words.filter((word) => word.level !== "mastered").map((word) => word.id);
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
    const nextWords = words.map((word) => word.id === currentId ? { ...word, level: mastered ? "mastered" as const : "learning" as const, lastReviewed: today } : word);
    setWords(nextWords);
    persistLocal(wordsStorageKey, nextWords);
    recordActivity();
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
    if (filter === "待复习") result = result.filter((word) => word.level !== "mastered");
    if (filter === "已掌握") result = result.filter((word) => word.level === "mastered");
    if (query.trim()) result = result.filter((word) => `${word.lemma} ${word.meaning} ${word.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
    return result;
  }, [filter, words, query]);

  const reviewed = words.filter((word) => word.lastReviewed === getLocalDate()).length;
  const streak = countStreak(activity.dates);
  const currentReview = words.find((word) => word.id === reviewQueue[reviewIndex]);
  const alreadySaved = hasAnalyzed && words.some((word) => word.lemma === analysis.lemma);

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
            <div className="review-progress"><span>今日复习</span><b>{reviewIndex + 1} / {reviewQueue.length}</b></div>
            <div className="progress-track"><i style={{ width: `${((reviewIndex + 1) / reviewQueue.length) * 100}%` }} /></div>
            <small>{revealed ? "你记对了吗？" : "看到这个词，你想起它的意思了吗？"}</small>
            <h2>{currentReview.lemma}</h2>
            <button className="modal-sound" onClick={() => speak(currentReview.lemma)}>))) {currentReview.phonetic}</button>
            {revealed ? <div className="review-answer"><h3>{currentReview.meaning}</h3><p>{currentReview.example}</p></div> : <button className="reveal-btn" autoFocus onClick={() => setRevealed(true)}>显示答案</button>}
            {revealed && <div className="review-actions"><button onClick={() => nextReview(false)}>还不熟</button><button onClick={() => nextReview(true)}>记住了 ✓</button></div>}
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
        <div className="date-note"><b>TODAY</b><strong>{words.length}</strong><span>你的词库<br /><em>{words.filter((word) => word.level !== "mastered").length} 个待复习</em></span></div>
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
          <div className="result-footer"><span>⌁ {analysis.tag}</span><div><button onClick={() => setEditing(!editing)}>{editing ? "完成编辑" : "✎ 编辑"}</button><button className="save-word" onClick={saveWord} disabled={loading || alreadySaved}>{alreadySaved ? "✓ 已在词库" : "＋ 收入词库"}</button></div></div>
          </>}
        </article>
      </section>

      <section className="library" id="wordbook">
        <div className="section-title">
          <div><span className="eyebrow"><i /> MY WORD GARDEN</span><h2>我的词库</h2></div>
          <p>已经拾起 <b>{words.length}</b> 个单词 · 今天复习 <b>{reviewed}</b> 个</p>
        </div>
        <div className="filter-row" role="group" aria-label="筛选单词">
          {["全部单词", "待复习", "已掌握"].map((name) => <button key={name} className={filter === name ? "selected" : ""} onClick={() => setFilter(name)}>{name}{name === "全部单词" && ` ${words.length}`}</button>)}
          {searching && <input className="library-search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="搜索单词、释义或分类" aria-label="搜索词库" />}
          <button className="search-btn" onClick={() => { setSearching(!searching); if (searching) setQuery(""); }} aria-label="搜索词库">{searching ? "×" : "⌕"}</button>
        </div>
        <div className="word-list">
          {filtered.map((word, index) => (
            <article className="word-row" key={word.id} style={{ "--row-delay": `${Math.min(index, 8) * 45}ms` } as CSSProperties}>
              <span className={`level-dot ${word.level}`} />
              <div className="word-main"><small>{String(index + 1).padStart(2, "0")}</small><div><h3>{word.lemma}</h3><p>{word.phonetic} · {word.part.split(" · ")[0]}</p></div></div>
              <div className="row-meaning"><b>{word.meaning}</b><span>原词：{word.original}</span></div>
              <span className="tag">{word.tag}</span>
              <button className={`master-btn ${word.level === "mastered" ? "done" : ""}`} onClick={() => updateLevel(word.id)} aria-label={word.level === "mastered" ? "标记为学习中" : "标记为已掌握"}>✓</button>
              <button className="row-sound" onClick={() => speak(word.lemma)} aria-label={`朗读 ${word.lemma}`}>)))</button>
              <button className="delete-btn" onClick={() => removeWord(word.id)} aria-label={`删除 ${word.lemma}`}>×</button>
            </article>
          ))}
          {filtered.length === 0 && <div className="empty">这里还没有单词，去拾起一个吧。</div>}
        </div>
      </section>

      <section className="review-banner" id="review">
        <div className="review-icon">↻</div><div><span>DAILY REVIEW</span><h2>今天还有 {Math.max(words.filter((w) => w.level !== "mastered").length, 0)} 个单词等待复习</h2><p>每天花 5 分钟，让记忆的线织得更牢。</p></div>
        <button onClick={openReview} disabled={!words.some((word) => word.level !== "mastered")}>开始今日复习 <b>→</b></button>
      </section>
      <footer><span>拾词 WORD LOOM</span><p>把偶遇的单词，织成自己的语言。</p><small>每一次遇见，都值得被记住 ✦</small></footer>
    </main>
  );
}
