export interface MockQuestion {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  chapter?: number;
  grammarPoint?: string;
  explanation?: string;
  sourceSlug?: string;
}

export interface OfficialSample {
  label: string;
  url: string;
}

interface ScrapedQuestion {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  chapter?: number | null;
  grammarPoint?: string | null;
  explanation?: string | null;
  sourceSlug?: string;
}

const scrapedModules = import.meta.glob<ScrapedQuestion[]>(
  "./scraped/*.json",
  { eager: true, import: "default" }
);

const scrapedQuestions: MockQuestion[] = Object.values(scrapedModules)
  .flat()
  .map((q) => ({
    id: q.id,
    question: q.question,
    choices: q.choices,
    answer: q.answer,
    chapter: q.chapter ?? undefined,
    grammarPoint: q.grammarPoint ?? undefined,
    explanation: q.explanation ?? undefined,
    sourceSlug: q.sourceSlug,
  }));

export function hasScrapedQuestions(): boolean {
  return scrapedQuestions.length > 0;
}

export function scrapedCount(): number {
  return scrapedQuestions.length;
}

export function getAllMockQuestions(): MockQuestion[] {
  return [...mockExamData, ...scrapedQuestions];
}

export const officialSamples: OfficialSample[] = [
  {
    label: "N4 Grammar — 2018 sample workbook (jlpt.jp)",
    url: "https://www.jlpt.jp/e/samples/sample2018/pdf/N4G.pdf",
  },
  {
    label: "N4 Grammar — 2012 sample workbook (jlpt.jp)",
    url: "https://www.jlpt.jp/e/samples/sample2012/pdf/N4G.pdf",
  },
  {
    label: "N4 \"Let's Try\" sample questions (jlpt.jp)",
    url: "https://www.jlpt.jp/e/samples/n4/index.html",
  },
];

export const mockExamData: MockQuestion[] = [
  {
    id: "mq-01",
    chapter: 26,
    grammarPoint: "～んです",
    question: "すみません、頭が 痛い＿＿。少し 休ませてください。",
    choices: ["です", "でした", "んです", "そうです"],
    answer: 2,
    explanation: "～んです provides explanation or reason; here it emphasizes why rest is needed due to the headache.",
  },
  {
    id: "mq-02",
    chapter: 26,
    grammarPoint: "～んです",
    question: "顔が 赤いですね。どう した＿＿か。",
    choices: ["の", "のです", "んです", "でしょう"],
    answer: 2,
    explanation: "～んです in questions seeks explanation; the question asks what is the reason for the red face.",
  },
  {
    id: "mq-03",
    chapter: 27,
    grammarPoint: "可能形",
    question: "この漢字は 難しくて、まだ ＿＿ません。",
    choices: ["読み", "読め", "読んで", "読んだ"],
    answer: 1,
    explanation: "Potential form 読め- + ません expresses inability; 'still cannot read this kanji yet.'",
  },
  {
    id: "mq-04",
    chapter: 27,
    grammarPoint: "～しか～ない",
    question: "財布には 100円 ＿＿ ありません。",
    choices: ["だけ", "しか", "ばかり", "など"],
    answer: 1,
    explanation: "～しか...ない means 'only' with negation; only 100 yen exists in the wallet, nothing more.",
  },
  {
    id: "mq-05",
    chapter: 27,
    grammarPoint: "見えます",
    question: "この部屋の 窓から 海が ＿＿ます。",
    choices: ["見ます", "見られ", "見え", "見て"],
    answer: 2,
    explanation: "見えます describes spontaneous visibility without effort; the sea naturally appears visible from the window.",
  },
  {
    id: "mq-06",
    chapter: 28,
    grammarPoint: "～ながら",
    question: "音楽を 聞き＿＿ 勉強します。",
    choices: ["ので", "ながら", "ば", "たら"],
    answer: 1,
    explanation: "～ながら describes simultaneous parallel activities; studying happens while listening to music.",
  },
  {
    id: "mq-07",
    chapter: 28,
    grammarPoint: "～し、～",
    question: "このレストランは 安い＿＿ おいしいし、よく 来ます。",
    choices: ["が", "し", "の", "で"],
    answer: 1,
    explanation: "～し、～ lists multiple reasons or qualities; both cheap and delicious explain frequent visits.",
  },
  {
    id: "mq-08",
    chapter: 28,
    grammarPoint: "それで",
    question: "きのうは 熱が ありました。＿＿ 会社を 休みました。",
    choices: ["しかし", "それで", "それに", "でも"],
    answer: 1,
    explanation: "それで shows consequence/result; because of the fever, taking the day off was the result.",
  },
  {
    id: "mq-09",
    chapter: 29,
    grammarPoint: "～てしまいました",
    question: "電車の 中に かさを 忘れて ＿＿。",
    choices: ["あります", "います", "しまいました", "おきました"],
    answer: 2,
    explanation: "～てしまいました conveys unintended completion with regret; unfortunately forgot the umbrella.",
  },
  {
    id: "mq-10",
    chapter: 29,
    grammarPoint: "～ています",
    question: "ドアが ＿＿。入っても いいですよ。",
    choices: ["あけています", "あいています", "あけてあります", "あけておきます"],
    answer: 1,
    explanation: "～ています with intransitive verb shows resultant state; the door is in an open state.",
  },
  {
    id: "mq-11",
    chapter: 30,
    grammarPoint: "～てあります",
    question: "壁に 絵が かけ＿＿。",
    choices: ["ています", "てあります", "ておきます", "てしまいます"],
    answer: 1,
    explanation: "～てあります shows intentional completed state; someone deliberately hung the picture there.",
  },
  {
    id: "mq-12",
    chapter: 30,
    grammarPoint: "～ておきます",
    question: "パーティーの 前に 飲み物を 買って ＿＿。",
    choices: ["あります", "います", "おきます", "しまいます"],
    answer: 2,
    explanation: "～ておきます indicates advance preparation; buy drinks beforehand for the party.",
  },
  {
    id: "mq-13",
    chapter: 31,
    grammarPoint: "～(よ)うと思っています",
    question: "週末、友達と 映画を 見＿＿ と 思っています。",
    choices: ["ます", "よう", "る", "た"],
    answer: 1,
    explanation: "～(よ)うと思っています expresses intention; planning to watch a movie with friends.",
  },
  {
    id: "mq-14",
    chapter: 31,
    grammarPoint: "つもりです",
    question: "来年、日本へ 行く ＿＿ です。",
    choices: ["よう", "そう", "つもり", "だろう"],
    answer: 2,
    explanation: "つもりです indicates firm plan or intention; going to Japan next year is decided.",
  },
  {
    id: "mq-15",
    chapter: 35,
    grammarPoint: "条件形 ば",
    question: "この薬は いつ 飲め＿＿ いいですか。",
    choices: ["なら", "ば", "たら", "と"],
    answer: 1,
    explanation: "ば conditional forms a hypothetical question; if one could choose, what time would be good?",
  },
  {
    id: "mq-16",
    chapter: 33,
    grammarPoint: "禁止形",
    question: "危ないから、ここに 入る ＿＿！",
    choices: ["な", "ね", "よ", "か"],
    answer: 0,
    explanation: "禁止形 (imperative negative) strongly prohibits action; warns 'Don't enter, it's dangerous!'",
  },
  {
    id: "mq-17",
    chapter: 34,
    grammarPoint: "Verb-た + とおりに",
    question: "先生の 言う ＿＿ 書いて ください。",
    choices: ["とおり", "ように", "ので", "から"],
    answer: 0,
    explanation: "～たとおりに means 'exactly as' or 'following how'; write precisely as the teacher instructs.",
  },
  {
    id: "mq-18",
    chapter: 35,
    grammarPoint: "条件形 ば",
    question: "時間が あれ＿＿、映画を 見に 行きます。",
    choices: ["と", "ば", "ても", "でも"],
    answer: 1,
    explanation: "ば conditional sets up a hypothesis; if there is time, then going to see a movie will happen.",
  },
  {
    id: "mq-19",
    chapter: 36,
    grammarPoint: "～ように",
    question: "日本語が 上手に なる ＿＿、毎日 勉強して います。",
    choices: ["ために", "ように", "から", "ので"],
    answer: 1,
    explanation: "～ように shows purpose/goal for non-volitional change; daily study aims for Japanese improvement.",
  },
  {
    id: "mq-20",
    chapter: 37,
    grammarPoint: "受身形",
    question: "子供の とき、母に よく ＿＿。",
    choices: ["しかります", "しかりました", "しかられました", "しからせました"],
    answer: 2,
    explanation: "受身形 (passive) 叱られました means 'was scolded'; the child was the recipient of the action.",
  },
  {
    id: "mq-21",
    chapter: 38,
    grammarPoint: "Verb-の + が好きです",
    question: "田中さんは 歌を 歌う ＿＿ 上手です。",
    choices: ["の", "のを", "のが", "ので"],
    answer: 2,
    explanation: "Verb-のが好きです nominalizes the action; singing (as an activity) is what is specifically liked.",
  },
  {
    id: "mq-22",
    chapter: 39,
    grammarPoint: "～ので",
    question: "熱が ある ＿＿、今日は 休みます。",
    choices: ["のに", "ので", "ように", "ために"],
    answer: 1,
    explanation: "～ので states objective reason/cause; fever (physical fact) necessitates taking the day off.",
  },
  {
    id: "mq-23",
    chapter: 45,
    grammarPoint: "～のに",
    question: "この部屋は きれいな ＿＿、だれも 使って いません。",
    choices: ["ので", "のに", "から", "けど"],
    answer: 1,
    explanation: "～のに expresses disappointed contrast; the room is clean yet nobody uses it (regrettable).",
  },
  {
    id: "mq-24",
    chapter: 41,
    grammarPoint: "～ていただきました",
    question: "先生に 日本語を 教えて ＿＿。",
    choices: ["あげました", "もらいました", "いただきました", "くれました"],
    answer: 2,
    explanation: "～ていただきました (humble) shows respectfully received favor; teacher's instruction was a benefit.",
  },
  {
    id: "mq-25",
    chapter: 42,
    grammarPoint: "～ために",
    question: "日本へ 旅行する ＿＿、お金を ためて います。",
    choices: ["ように", "ために", "ので", "から"],
    answer: 1,
    explanation: "～ために shows volitional purpose/goal; saving money intentionally aims for the Japan trip.",
  },
  {
    id: "mq-26",
    chapter: 43,
    grammarPoint: "そうです",
    question: "この ケーキは おいし ＿＿ ですね。",
    choices: ["そう", "よう", "らしい", "みたい"],
    answer: 0,
    explanation: "Adjective + そうです describes visual appearance; the cake looks delicious by its appearance.",
  },
  {
    id: "mq-27",
    chapter: 44,
    grammarPoint: "～すぎます",
    question: "ゆうべ お酒を 飲み ＿＿ ました。頭が 痛いです。",
    choices: ["やすい", "にくい", "すぎ", "そう"],
    answer: 2,
    explanation: "～すぎます expresses excess or 'too much'; drinking too much alcohol resulted in a headache.",
  },
  {
    id: "mq-28",
    chapter: 47,
    grammarPoint: "～そうです",
    question: "ニュースに よると、台風が 来る ＿＿ です。",
    choices: ["そう", "よう", "みたい", "らしい"],
    answer: 0,
    explanation: "～そう (hearsay) reports received information from a source; according to news, a typhoon is coming.",
  },
  {
    id: "mq-29",
    chapter: 48,
    grammarPoint: "使役形",
    question: "先生は 学生に 作文を 書 ＿＿ ました。",
    choices: ["き", "かれ", "かせ", "こう"],
    answer: 2,
    explanation: "使役形 (causative) 書かせました means 'made write'; teacher caused students to compose essays.",
  },
  {
    id: "mq-30",
    chapter: 49,
    grammarPoint: "特別な尊敬語",
    question: "社長は もう ＿＿ ましたか。(=食べる)",
    choices: ["食べ", "お食べし", "召し上がり", "いただき"],
    answer: 2,
    explanation: "召し上がり is a special honorific verb for 'eat'; politely asking if the president has already eaten.",
  },
  {
    id: "mq-31",
    chapter: 50,
    grammarPoint: "お + Verb-stem + します",
    question: "私が お荷物を ＿＿ます。",
    choices: ["持ち", "お持ちし", "お持ちになり", "持たせ"],
    answer: 1,
    explanation: "Humble お持ちします offers politely; the speaker respectfully carries the baggage.",
  },
];
