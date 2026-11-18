import type { AppControlAction, BestiePersonality } from "../types/studio";

export interface OfflineParseResult {
  reply: string;
  actions: AppControlAction[];
}

export function parseOfflineBestieCommand(
  rawInput: string,
  personality: BestiePersonality
): OfflineParseResult {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const actions: AppControlAction[] = [];

  // 1. Log Money (NGN ₦ or USD $)
  const moneyMatch = input.match(
    /(?:log|add|earned|made|received|spent|paid)\s*(?:(₦|ngn|\$|usd)\s*)?([\d,]+(?:\.\d+)?)\s*(ngn|naira|usd|dollars?)?/i
  );
  if (
    moneyMatch &&
    (lower.includes("₦") ||
      lower.includes("$") ||
      lower.includes("ngn") ||
      lower.includes("naira") ||
      lower.includes("usd") ||
      lower.includes("income") ||
      lower.includes("expense") ||
      lower.includes("spent"))
  ) {
    const num = Number(moneyMatch[2].replace(/,/g, ""));
    if (!Number.isNaN(num) && num > 0) {
      const currencyHint = `${moneyMatch[1] || ""} ${moneyMatch[3] || ""} ${lower}`;
      const currency: "NGN" | "USD" =
        currencyHint.includes("$") || currencyHint.includes("usd") || currencyHint.includes("dollar")
          ? "USD"
          : "NGN";
      const isExpense =
        lower.includes("expense") || lower.includes("spent") || lower.includes("paid");
      const symbol = currency === "NGN" ? "₦" : "$";
      actions.push({
        type: "LOG_MONEY",
        label: `Logged ${isExpense ? "-" : "+"}${symbol}${num.toLocaleString()} ${isExpense ? "expense" : "income"}`,
        amount: num,
        currency,
        moneyType: isExpense ? "expense" : "income",
        title: isExpense ? "Offline Logged Expense" : "Offline Logged Income",
      });
    }
  }

  // 2. Add Task
  const taskMatch = input.match(/^(?:add\s+task|task:|todo:)\s+(.+)$/i);
  if (taskMatch && taskMatch[1].trim()) {
    const taskTitle = taskMatch[1].trim();
    actions.push({
      type: "ADD_TASK",
      label: `Added task: ${taskTitle}`,
      title: taskTitle,
      tag: "Personal",
    });
  }

  // 3. Log Water
  if (lower.includes("water") && (lower.includes("log") || lower.includes("drank") || lower.includes("add"))) {
    const numMatch = input.match(/(\d+)/);
    const delta = numMatch ? Number(numMatch[1]) : 1;
    actions.push({
      type: "LOG_WATER",
      label: `+${delta} glass${delta === 1 ? "" : "es"} of water`,
      delta,
    });
  }

  // 4. Log Posts Today
  if ((lower.includes("post") || lower.includes("reel") || lower.includes("video")) && (lower.includes("log") || lower.includes("published") || lower.includes("posted"))) {
    const numMatch = input.match(/(\d+)/);
    const delta = numMatch ? Number(numMatch[1]) : 1;
    actions.push({
      type: "LOG_POST",
      label: `+${delta} post${delta === 1 ? "" : "s"} logged`,
      delta,
    });
  }

  // 5. Log Sleep
  if (lower.includes("sleep") || lower.includes("slept")) {
    const numMatch = input.match(/(\d+(?:\.\d+)?)/);
    const hrs = numMatch ? Number(numMatch[1]) : 8;
    actions.push({
      type: "LOG_SLEEP",
      label: `Sleep updated to ${hrs}h`,
      amount: hrs,
    });
  }

  // 6. Save Note
  const noteMatch = input.match(/^(?:save\s+note|note:)\s+(.+)$/i);
  if (noteMatch && noteMatch[1].trim()) {
    const noteText = noteMatch[1].trim();
    actions.push({
      type: "SAVE_NOTE",
      label: "Saved note to Second Brain (queued for AI enrichment)",
      title: noteText.slice(0, 48),
      noteContent: noteText,
      tag: "Ideas",
    });
  }

  // 7. Add Habit (strictly explicit habit or recurring daily routine requests)
  const habitMatch =
    input.match(/^(?:add\s+habit|habit:)\s+(.+)$/i) ||
    input.match(/^(?:remind\s+me\s+to|every\s+day\s+i\s+want\s+to)\s+(.+?)(?:\s+daily|\s+every\s+day)?$/i);
  if (
    habitMatch &&
    habitMatch[1].trim() &&
    (lower.startsWith("add habit") ||
      lower.startsWith("habit:") ||
      lower.includes("daily") ||
      lower.includes("every day"))
  ) {
    const habitLabel = habitMatch[1].trim();
    actions.push({
      type: "ADD_HABIT",
      label: `Added habit: ${habitLabel}`,
      title: habitLabel,
    });
  }

  // 8. Save Memory
  const memMatch = input.match(/^(?:remember(?:\s+that)?|save\s+memory)\s+(.+)$/i);
  if (memMatch && memMatch[1].trim()) {
    const fact = memMatch[1].trim();
    actions.push({
      type: "SAVE_MEMORY",
      label: "Saved to Memory Vault",
      title: fact,
      memoryCategory: "Personal",
    });
  }

  if (actions.length > 0) {
    const reply =
      personality === "bestie"
        ? `Got you (Offline Mode — no internet connection)! I updated your workspace locally and saved everything.`
        : `Offline mode active (no internet connection). Executed locally: ${actions.map((a) => a.label).join("; ")}.`;
    return { reply, actions };
  }

  return {
    reply:
      personality === "bestie"
        ? "You're currently offline, so full Gemini AI chat is paused until you reconnect — you can still use quick local commands like \"Add task ...\", \"Log ₦20,000 income\", \"Log 2 glasses of water\", \"Save note ...\", or \"Remember ...\"!"
        : "You're currently offline. Supported local commands: \"Add task [name]\", \"Log ₦20,000 income\", \"Log [N] water\", \"Slept [N] hours\", \"Save note [text]\", or \"Remember [fact]\".",
    actions: [],
  };
}
