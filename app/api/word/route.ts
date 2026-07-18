import { NextRequest, NextResponse } from "next/server";

const partNames: Record<string, string> = { noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词", pronoun: "代词", preposition: "介词", conjunction: "连词", interjection: "感叹词" };
const tagNames: Record<string, string> = { noun: "名词积累", verb: "动作表达", adjective: "描述表达", adverb: "常用表达" };

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word")?.toLowerCase().replace(/[^a-z'-]/g, "");
  if (!word) return NextResponse.json({ error: "请输入有效的英文单词" }, { status: 400 });

  try {
    const dictionaryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { headers: { Accept: "application/json" } });
    if (!dictionaryResponse.ok) return NextResponse.json({ error: "没有找到这个单词" }, { status: 404 });
    const entries = await dictionaryResponse.json();
    const entry = entries[0];
    const sense = entry.meanings?.[0];
    const detail = sense?.definitions?.[0];
    const definition = detail?.definition || "No definition available.";
    const part = sense?.partOfSpeech || "word";

    let meaning = definition;
    try {
      const translateResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(definition)}&langpair=en|zh-CN`);
      if (translateResponse.ok) {
        const translated = await translateResponse.json();
        if (translated.responseData?.translatedText) meaning = translated.responseData.translatedText;
      }
    } catch { /* English definition remains a useful fallback. */ }

    return NextResponse.json({
      lemma: entry.word || word,
      phonetic: entry.phonetic || entry.phonetics?.find((item: { text?: string }) => item.text)?.text || "/—/",
      part: `${part} · ${partNames[part] || "词语"}`,
      meaning,
      definition,
      example: detail?.example || `I learned how to use the word “${word}” today.`,
      tag: tagNames[part] || "日常积累",
    }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "词典服务暂时不可用，请稍后重试" }, { status: 503 });
  }
}
