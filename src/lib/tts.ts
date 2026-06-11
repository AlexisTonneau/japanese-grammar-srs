export function speakJapanese(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  utter.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const jp = voices.find((v) => v.lang.toLowerCase().startsWith("ja"));
  if (jp) utter.voice = jp;
  window.speechSynthesis.speak(utter);
}
