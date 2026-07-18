"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
};

const irregular: Record<string, string> = {
  children: "child", men: "man", women: "woman", feet: "foot", teeth: "tooth",
  mice: "mouse", geese: "goose", went: "go", gone: "go", better: "good",
  best: "good", worse: "bad", worst: "bad", ran: "run", written: "write",
  wrote: "write", spoken: "speak", spoke: "speak", bought: "buy", brought: "bring",
};

const wordBook: Record<string, Omit<WordData, "id" | "original" | "level">> = {
  run: { lemma: "run", phonetic: "/rʌn/", part: "verb · 动词", meaning: "跑；运行；经营", definition: "to move quickly using your legs", example: "She runs along the river every morning.", tag: "日常生活" },
  explore: { lemma: "explore", phonetic: "/ɪkˈsplɔːr/", part: "verb · 动词", meaning: "探索；探究", definition: "to travel around a place to learn about it", example: "We spent the afternoon exploring the old town.", tag: "旅行见闻" },
  library: { lemma: "library", phonetic: "/ˈlaɪbreri/", part: "noun · 名词", meaning: "图书馆；资料库", definition: "a place where books and other materials are kept", example: "I found this novel in the local library.", tag: "阅读积累" },
  child: { lemma: "child", phonetic: "/tʃaɪld/", part: "noun · 名词", meaning: "儿童；孩子", definition: "a young person who is not yet an adult", example: "Every child learns at a different pace.", tag: "日常生活" },
  good: { lemma: "good", phonetic: "/ɡʊd/", part: "adjective · 形容词", meaning: "好的；优秀的；有益的", definition: "of a high quality or standard", example: "Reading is a good way to grow your vocabulary.", tag: "常用表达" },
  inspire: { lemma: "inspire", phonetic: "/ɪnˈspaɪər/", part: "verb · 动词", meaning: "启发；激励", definition: "to make someone feel that they want to do something", example: "Her story inspired me to keep learning.", tag: "阅读积累" },
};

const initialWords: WordData[] = [
  { id: "w1", original: "exploring", ...wordBook.explore, level: "learning" },
  { id: "w2", original: "libraries", ...wordBook.library, level: "new" },
  { id: "w3", original: "inspired", ...wordBook.inspire, level: "mastered" },
];

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
  const [input, setInput] = useState("running");
  const [analysis, setAnalysis] = useState<WordData>({ id: "preview", original: "running", ...wordBook.run, level: "new" });
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [filter, setFilter] = useState("全部单词");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("wordloom-words");
    if (saved) setWords(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("wordloom-words", JSON.stringify(words));
  }, [words]);

  async function analyze(e?: FormEvent) {
    e?.preventDefault();
    const original = input.trim().toLowerCase();
    const lemma = toLemma(original);
    if (!lemma) return;
    setLoading(true);
    const known = wordBook[lemma];
    if (known) {
      setTimeout(() => {
        setAnalysis({ id: `${Date.now()}-${lemma}`, original, ...known, level: "new" });
        setLoading(false);
      }, 420);
      return;
    }
    const pending = fallbackData(original, lemma);
    setAnalysis(pending);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lemma)}`);
      if (!response.ok) throw new Error("not found");
      const data = await response.json();
      const entry = data[0];
      const sense = entry.meanings?.[0];
      const detail = sense?.definitions?.[0];
      setAnalysis({
        ...pending,
        phonetic: entry.phonetic || entry.phonetics?.find((item: { text?: string }) => item.text)?.text || "/—/",
        part: `${sense?.partOfSpeech || "word"} · 词性`,
        meaning: detail?.definition || "暂未找到释义",
        definition: detail?.definition || "No definition available yet.",
        example: detail?.example || pending.example,
      });
    } catch {
      setAnalysis({ ...pending, phonetic: "/—/", meaning: "暂未收录，可稍后补充中文释义" });
    } finally {
      setLoading(false);
    }
  }

  function saveWord() {
    if (words.some((word) => word.lemma === analysis.lemma)) {
      setToast("这个单词已经在词库里啦");
    } else {
      setWords((current) => [{ ...analysis, id: `${Date.now()}-${analysis.lemma}` }, ...current]);
      setToast(`已把 ${analysis.lemma} 收进词库`);
    }
    setTimeout(() => setToast(""), 2200);
  }

  function speak(word: string) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(word));
    }
  }

  const filtered = useMemo(() => {
    if (filter === "待复习") return words.filter((word) => word.level !== "mastered");
    if (filter === "已掌握") return words.filter((word) => word.level === "mastered");
    return words;
  }, [filter, words]);

  const reviewed = words.filter((word) => word.level === "mastered").length;

  return (
    <main className="app-shell">
      {toast && <div className="toast" role="status">✓ {toast}</div>}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="拾词首页">
          <span className="brand-mark">拾</span>
          <span><b>拾词</b><small>Word Loom</small></span>
        </a>
        <nav aria-label="主导航">
          <a className="active" href="#collect">收词</a>
          <a href="#wordbook">词库</a>
          <a href="#review">复习</a>
        </nav>
        <button className="streak" onClick={() => setToast("连续学习 12 天，真棒！")}>🔥 <b>12</b> 天</button>
      </header>

      <section className="hero" id="collect">
        <div className="hero-copy">
          <span className="eyebrow"><i /> 今天，遇见了什么新词？</span>
          <h1>随手拾起，<br />让每个单词<span>留下来。</span></h1>
          <p>复制一个刚刚遇见的单词，剩下的整理工作交给拾词。</p>
        </div>
        <div className="date-note"><b>JUL</b><strong>18</strong><span>今日已收录<br /><em>{Math.max(words.length - 2, 1)} 个新词</em></span></div>
      </section>

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
          </form>
          <div className="tip"><span>✦</span><p><b>小提示</b>你可以直接粘贴 <i>libraries</i>、<i>exploring</i>，拾词会自动还原原形。</p></div>
        </div>

        <article className={`result-card paper-card ${loading ? "is-loading" : ""}`} aria-live="polite">
          <div className="card-label"><span>02</span> 智能整理结果</div>
          <div className="original-line">你输入了 <del>{analysis.original}</del><span>已还原原形 ✓</span></div>
          <div className="word-heading">
            <div><h2>{analysis.lemma}</h2><p>{analysis.phonetic}</p></div>
            <button className="sound" onClick={() => speak(analysis.lemma)} aria-label={`朗读 ${analysis.lemma}`}>)))</button>
          </div>
          <span className="part-badge">{analysis.part}</span>
          <div className="meaning-block"><small>核心释义</small><h3>{analysis.meaning}</h3><p>{analysis.definition}</p></div>
          <blockquote>“{analysis.example}”<small>例句 · Example</small></blockquote>
          <div className="result-footer"><span>⌁ {analysis.tag}</span><button onClick={saveWord}>＋ 收入词库</button></div>
        </article>
      </section>

      <section className="library" id="wordbook">
        <div className="section-title">
          <div><span className="eyebrow"><i /> MY WORD GARDEN</span><h2>我的词库</h2></div>
          <p>已经拾起 <b>{words.length}</b> 个单词 · 今天复习 <b>{reviewed}</b> 个</p>
        </div>
        <div className="filter-row" role="group" aria-label="筛选单词">
          {["全部单词", "待复习", "已掌握"].map((name) => <button key={name} className={filter === name ? "selected" : ""} onClick={() => setFilter(name)}>{name}{name === "全部单词" && ` ${words.length}`}</button>)}
          <button className="search-btn" aria-label="搜索词库">⌕</button>
        </div>
        <div className="word-list">
          {filtered.map((word, index) => (
            <article className="word-row" key={word.id}>
              <span className={`level-dot ${word.level}`} />
              <div className="word-main"><small>{String(index + 1).padStart(2, "0")}</small><div><h3>{word.lemma}</h3><p>{word.phonetic} · {word.part.split(" · ")[0]}</p></div></div>
              <div className="row-meaning"><b>{word.meaning}</b><span>原词：{word.original}</span></div>
              <span className="tag">{word.tag}</span>
              <button className="row-sound" onClick={() => speak(word.lemma)} aria-label={`朗读 ${word.lemma}`}>)))</button>
              <button className="more" aria-label="更多操作">•••</button>
            </article>
          ))}
          {filtered.length === 0 && <div className="empty">这里还没有单词，去拾起一个吧。</div>}
        </div>
      </section>

      <section className="review-banner" id="review">
        <div className="review-icon">↻</div><div><span>DAILY REVIEW</span><h2>今天还有 {Math.max(words.filter((w) => w.level !== "mastered").length, 0)} 个单词等待复习</h2><p>每天花 5 分钟，让记忆的线织得更牢。</p></div>
        <button onClick={() => setToast("复习卡片已经准备好")}>开始今日复习 <b>→</b></button>
      </section>
      <footer><span>拾词 WORD LOOM</span><p>把偶遇的单词，织成自己的语言。</p><small>每一次遇见，都值得被记住 ✦</small></footer>
    </main>
  );
}
