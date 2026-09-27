const fencedText = /^```(?:text|plaintext|markdown|json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i;
const answerObject = /^\{\s*"answer"\s*:\s*("(?:\\.|[^"\\])*")\s*\}$/s;
const escapedString = /^"(?:\\.|[^"\\])*"$/s;

export function normalizeFinalAnswer(answer: string): string {
  const original = answer.trim();
  let text = original;

  for (let depth = 0; depth < 3; depth += 1) {
    const fence = fencedText.exec(text);
    if (fence) {
      text = fence[1].trim();
      continue;
    }

    const wrappedAnswer = answerObject.exec(text);
    if (wrappedAnswer) {
      try {
        text = (JSON.parse(wrappedAnswer[1]) as string).trim();
        continue;
      } catch {
        // A malformed answer wrapper is ordinary response text.
      }
    }

    if (escapedString.test(text) && text.includes('\\"')) {
      try {
        text = (JSON.parse(text) as string).trim();
        continue;
      } catch {
        // An invalid escaped string is ordinary response text.
      }
    }

    break;
  }

  return (text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\s][^*\n]*?[^*\s]|[^*\s])\*(?=$|[\s.,;:!?)]|\n)/g, '$1$2')
    .replace(/^([ \t]*)\*([ \t]+)/gm, '$1-$2')) || original;
}
