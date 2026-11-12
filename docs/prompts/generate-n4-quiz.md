# Prompt: Generate JLPT N4 grammar quiz questions

Copy everything below the line into Claude. Fill in the `{{…}}` placeholders first. Save the output as `src/data/scraped/<name>.json` and the mock exam picks it up automatically.

---

You are an experienced JLPT item writer. Write original JLPT N4 grammar questions (言語知識・文法) that are indistinguishable from real exam items: same tone, difficulty, sentence length, and distractor style as the official 問題1 and 問題2. Each question is tagged with the Minna no Nihongo Book 2 chapter (26–50) of the grammar point it tests.

## Inputs

- Number of questions: {{COUNT, e.g. 20}}
- Target chapters: {{e.g. "31, 33", "26–35", or "all of 26–50"}}
- Questions per chapter: {{e.g. "even split", or "31: 5, 33: 10"}}
- ID prefix and starting number: {{e.g. "gen", 1}}
- Question-type mix: {{e.g. "80% fill-in-the-blank, 20% star ordering"}}
- Grammar points or sentences to avoid (already in the bank): {{optional list}}

## Question types

1. **Fill-in-the-blank (文法形式の判断).** One sentence with a single blank written as ` ＿＿ `. Four choices; exactly one fits grammatically and in context.
2. **Star ordering (文の組み立て).** The sentence has four blanks, one marked with ★, e.g. `…  ＿＿ ＿＿ ★ ＿＿ …`. Vary the ★ position across all four blanks within a batch. The four choices are the fragments that fill the blanks. `answer` is the index of the fragment that goes in the ★ slot. The `explanation` must show the full correct sentence.

## Writing rules

- **Level.** Grammar and vocabulary must be N4 or lower. Never test N3+ grammar, even as a distractor. Write words with their normal kanji spelling; no need to switch to hiragana.
- **Natural Japanese.** Sentences should sound like everyday conversation or simple writing a native speaker would actually produce. Add a short context clause or a second sentence (e.g. 「Ａ：… Ｂ：…」) whenever the answer depends on nuance like politeness, direction of giving, or speaker intent.
- **One correct answer.** Each distractor must be clearly wrong in this sentence. Wrong could mean ungrammatical, the wrong conjugation, the wrong nuance, or a mismatch with the context. Reject any item where a native speaker could defend two choices.
- **Good distractors.** Use the mistakes learners actually make: neighbouring forms (て/た/ない/辞書形), confusable pairs (のに/ので, ために/ように, あげる/くれる/もらう, そうです hearsay/appearance, 尊敬語/謙譲語), and wrong attachments (な vs の vs ∅). All four choices should have similar length and form so the answer doesn't stand out. Like the real exam, the item should be decided by meaning, context, or connection, not by spotting the only well-formed conjugation: avoid items where three choices are simply malformed.
- **Spread the answers.** Spread correct indices 0–3 roughly evenly, with no visible pattern.
- **No giveaways.** Don't put the target pattern's English meaning in the question. Only add a parenthetical hint like `(=食べる)` when the item tests a special honorific or humble verb.
- **Variety.** Within a batch, don't repeat a sentence frame, subject, or scenario; no setting (trains, restaurants, phone calls, …) more than twice per 50 items. Vary the register: at least a third of items in plain/casual speech, and mix dialogues (Ａ：… Ｂ：…) with single sentences, notes, and announcements. Vary the topics (work, school, family, hobbies, health, weather, neighbours, events, housework, money).

## Chapter mapping (mandatory)

Every question tests exactly one grammar point from the chapter list below, and it belongs to that chapter.

- `chapter` is required. It must be an integer from the target chapters and can never be `null`.
- `grammarPoint` must be copied **character for character** from that chapter's list. Don't invent, shorten, or translate labels.
- The chapter only tags the point being tested. The rest of the sentence and the distractors may use any N4 grammar, from any chapter, just as the real exam does.
- Within a chapter, spread questions across its grammar points before reusing any of them.
- If a point can't be tested well as a 4-choice item (e.g. a pure vocabulary connector), pick another point from the same chapter.

### Grammar points by chapter (Minna no Nihongo Book 2)

- **26:** `～んです` · `～んですが、～ていただけませんか` · `疑問詞 + ～たらいいですか` · `～んです (asking for explanation)`
- **27:** `可能形 (potential form)` · `可能形 (negative)` · `可能形 (question)` · `見えます (spontaneous visibility)` · `聞こえます (spontaneous audibility)` · `できます (completion / coming into being)` · `は (contrast)` · `も (inclusive, with other particles)` · `～しか～ない` · `～しか～ない (with counters)`
- **28:** `～ながら` · `～ながら (long-term parallel activities)` · `Verb て-form + います (habit)` · `Plain form + し、～` · `～し、～ (listing reasons)` · `それに` · `それで`
- **29:** `Verb て-form + います (resultant state, intransitive)` · `Verb て-form + います (broken / damaged state)` · `は + ています (topicalized state)` · `～てしまいます (completion)` · `～てしまいました (regret)` · `～てしまいました (regret, lost / dropped)` · `どこかで / どこかに`
- **30:** `～てあります (intentional state, transitive)` · `～てあります (schedule / written down)` · `～てあります (topicalized — already done)` · `～ておきます (preparation in advance)` · `～ておきます (leave as is)` · `まだ + affirmative`
- **31:** `意向形 (volitional)` · `～(よ)うと思っています` · `Dictionary form + つもりです` · `ない form + つもりです` · `～予定です` · `まだ + Verb て-form + いません`
- **32:** `～たほうがいいです` · `～ないほうがいいです` · `～でしょう (inference)` · `～かもしれません` · `たぶん` · `もしかしたら～かもしれません` · `数量詞 + で (extent / limit)`
- **33:** `命令形 (imperative)` · `禁止形 (prohibitive)` · `命令形 / 禁止形 (signage and emergencies)` · `～と読みます / ～と書きます` · `Noun1 は Noun2 という意味です` · `～と言っていました (reported speech)` · `～と伝えていただけませんか`
- **34:** `Noun + のとおりに` · `Verb-dictionary / Verb-た + とおりに` · `Verb-た + とおりに (after the fact)` · `Verb-た + あとで` · `Verb-た + あとで (sequence)` · `Verb-て / Verb-ないで (manner)` · `Verb-ないで (instead of)`
- **35:** `条件形 ば (verbs)` · `条件形 ば (い-adj / な-adj / noun)` · `～ば～ほど` · `疑問詞 + ば + いいですか` · `ば vs と (subject restriction)` · `たら (flexible conditional)`
- **36:** `～ように (purpose, non-volitional)` · `～ないように (preventive purpose)` · `～ようになりました (change of state)` · `～ようにしています (ongoing effort)` · `～ようにしてください (polite effort request)` · `とか (colloquial listing)`
- **37:** `受身形 (passive form)` · `迷惑の受身 (adversity passive)` · `迷惑の受身 (with personal items)` · `受身 (object-focused, no agent)` · `～によって + 受身 (creator / inventor)` · `材料 (から / で)`
- **38:** `Verb-の + が好きです (nominalizer)` · `Verb-の + を忘れました` · `Verb-の + を知っていますか` · `Verb-の + は + Noun です (cleft)` · `Verb-の + は + Adjective です`
- **39:** `～て / ～で (cause, emotional)` · `～なくて (negative cause)` · `Noun + で (natural cause)` · `～ので (objective reason)` · `～ので vs から` · `～途中で`
- **40:** `疑問詞 + 普通形 + か` · `～かどうか` · `～かどうか (checking)` · `～てみます` · `～てみたいです` · `い-adj + さ → noun`
- **41:** `やります (giving downward)` · `いただきます (humble receive)` · `くださいます (respectful give-to-me)` · `～てやります (do for someone lower)` · `～ていただきます (humble received favor)` · `～てくださいます (respectful done-for-me)` · `～てくださいませんか (polite request)`
- **42:** `～ために (purpose, volitional)` · `Noun + のために (for the sake of)` · `Verb dictionary form + のに (purpose / use)` · `Verb dictionary form + のに (time/effort)` · `Quantity + は (at least)` · `Quantity + も (as much as)`
- **43:** `Verb-stem + そうです (looks about to)` · `Adjective + そうです (looks)` · `～てきます (go do and return)` · `～へ行ってきます` · `出かけてきます`
- **44:** `～すぎます` · `～やすい / ～にくい` · `～やすい (tendency)` · `い-adj → くします (transform)` · `な-adj / Noun + にします (transform)` · `Noun + にします (decide / choose)` · `Adj-stem + Verb (adverbial)`
- **45:** `～場合は (hypothetical case)` · `～場合は (negative)` · `Noun + の場合は` · `～のに (despite, with disappointment)` · `～のに vs が / ても`
- **46:** `～ところです (about to)` · `～ているところです (right now)` · `～たところです (just finished)` · `～たばかりです (recently)` · `～はずです (confident expectation)`
- **47:** `～そうです (hearsay)` · `～そうです (hearsay, adjective)` · `～ようです (subjective inference)` · `～ようです (suspecting)` · `音/声/におい/味 + がします`
- **48:** `使役形 (causative)` · `使役 (intransitive verb, person takes を)` · `使役 (transitive verb, person takes に)` · `使役 (emotion-triggering)` · `使役て + いただけませんか`
- **49:** `尊敬語 (passive-form honorific)` · `お + Verb-stem + になります` · `特別な尊敬語 (special honorifics)` · `お + Verb-stem + ください` · `お / ご prefix`
- **50:** `お + Verb-stem + します (humble)` · `お + Verb-stem + します (formal offering)` · `ご + Verb-stem + します (Sino-Japanese)` · `特別な謙譲語 (special humble verbs)` · `丁寧語 (extra-polite)` · `丁寧語 (asking preference)`

## Explanation

- `explanation` is in English, at most 25 words. Say why the correct choice fits and, where useful, why the most tempting distractor doesn't. Use Japanese only to quote forms.

## Output format

Return **only** a JSON array with no markdown fences and no commentary. Each element must match exactly:

```json
{
  "id": "gen-001",
  "question": "雨が 降っている ＿＿ 、試合は 中止に なりませんでした。",
  "choices": ["ので", "のに", "から", "ために"],
  "answer": 1,
  "chapter": 45,
  "grammarPoint": "～のに (despite, with disappointment)",
  "explanation": "のに marks an unexpected result despite the rain; ので/から would wrongly imply the rain caused cancellation."
}
```

- `id`: prefix plus a zero-padded 3-digit number, sequential.
- `choices`: exactly 4 strings with no numbering or labels.
- `answer`: 0-based index into `choices`.

## Self-check before answering

For each item, silently confirm all of the following. Fix or replace any item that fails.
1. The correct choice really is the only acceptable one.
2. Every grammar form and word is N4 level or lower, and the item reads like a real JLPT question.
3. `answer` points to the right index, and for ★ items it points to the ★ fragment.
4. `chapter` is set, it is one of the target chapters, and `grammarPoint` appears verbatim in that chapter's list.
5. The batch meets the variety rules: settings, register, and ★ positions.
6. The JSON is valid: double quotes, no trailing commas.
