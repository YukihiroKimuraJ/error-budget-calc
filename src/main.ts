// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface SLOConfig {
  targetPercent: number; // 例: 99.9
  windowDays: number;    // 例: 30
}

interface ErrorBudgetResult {
  totalMinutes: number;    // バジェット合計 (分)
  usedMinutes: number;     // 使用済み (分)
  remainingMinutes: number; // 残り (分) ※マイナスになることも
  usedPercent: number;     // 使用率 (%)
  isExceeded: boolean;     // 超過しているか
}

// ─── 計算ロジック ──────────────────────────────────────────────────────────────

function calculateErrorBudget(
  config: SLOConfig,
  downtimeMinutes: number
): ErrorBudgetResult {
  const totalMinutesInWindow = config.windowDays * 24 * 60;
  const allowedUnavailabilityRatio = 1 - config.targetPercent / 100;
  const totalBudgetMinutes = totalMinutesInWindow * allowedUnavailabilityRatio;

  const remainingMinutes = totalBudgetMinutes - downtimeMinutes;
  const usedPercent = totalBudgetMinutes > 0
    ? (downtimeMinutes / totalBudgetMinutes) * 100
    : 0;

  return {
    totalMinutes: totalBudgetMinutes,
    usedMinutes: downtimeMinutes,
    remainingMinutes,
    usedPercent,
    isExceeded: remainingMinutes < 0,
  };
}

// ─── 表示フォーマット ──────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 1) {
    return `${(abs * 60).toFixed(0)} 秒`;
  } else if (abs < 60) {
    return `${abs.toFixed(1)} 分`;
  } else if (abs < 60 * 24) {
    const h = Math.floor(abs / 60);
    const m = Math.round(abs % 60).toString().padStart(2, "0");
    return `${h} 時間 ${m} 分`;
  } else {
    const d = Math.floor(abs / (60 * 24));
    const h = Math.floor((abs % (60 * 24)) / 60);
    return `${d} 日 ${h} 時間`;
  }
}

type StatusInfo = { label: string; color: string; bg: string; emoji: string };

function getStatusInfo(result: ErrorBudgetResult): StatusInfo {
  if (result.isExceeded) {
    return { label: "バジェット超過", color: "#ef4444", bg: "#fef2f2", emoji: "🔴" };
  } else if (result.usedPercent >= 80) {
    return { label: "残りわずか", color: "#f59e0b", bg: "#fffbeb", emoji: "🟡" };
  } else {
    return { label: "正常範囲", color: "#22c55e", bg: "#f0fdf4", emoji: "🟢" };
  }
}

// ─── DOM 操作 ──────────────────────────────────────────────────────────────────

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el;
}

function updateUI(): void {
  const sloInput     = getElement<HTMLInputElement>("slo");
  const windowInput  = getElement<HTMLInputElement>("window");
  const downtimeInput = getElement<HTMLInputElement>("downtime");

  const targetPercent   = parseFloat(sloInput.value);
  const windowDays      = parseFloat(windowInput.value);
  const downtimeMinutes = parseFloat(downtimeInput.value);

  // 不正入力は無視
  if (
    isNaN(targetPercent) || isNaN(windowDays) || isNaN(downtimeMinutes) ||
    targetPercent <= 0 || targetPercent >= 100 || windowDays <= 0 || downtimeMinutes < 0
  ) {
    return;
  }

  const result = calculateErrorBudget({ targetPercent, windowDays }, downtimeMinutes);
  const status = getStatusInfo(result);

  // 数値の更新
  getElement("total-budget").textContent = formatMinutes(result.totalMinutes);
  getElement("used-budget").textContent  = formatMinutes(result.usedMinutes);

  const remainingEl = getElement("remaining-budget");
  remainingEl.textContent = (result.isExceeded ? "−" : "") + formatMinutes(result.remainingMinutes);
  remainingEl.style.color = status.color;

  // プログレスバー
  const barFill = getElement("bar-fill");
  const clampedPercent = Math.min(result.usedPercent, 100);
  barFill.style.width           = `${clampedPercent}%`;
  barFill.style.backgroundColor = status.color;

  const barLabel = getElement("bar-label");
  barLabel.textContent = `${result.usedPercent.toFixed(1)}% 使用`;

  // ステータスバッジ
  const statusEl = getElement("status");
  statusEl.textContent        = `${status.emoji}  ${status.label}`;
  statusEl.style.color        = status.color;
  statusEl.style.backgroundColor = status.bg;
  statusEl.style.borderColor  = status.color;
}

// ─── 初期化 ────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const inputs = document.querySelectorAll<HTMLInputElement>("input[type='number']");
  inputs.forEach((input) => input.addEventListener("input", updateUI));
  updateUI();
});
