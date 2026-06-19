/**
 * Turkish-bank vs Sava comparison, in DOLLAR terms (D2). The honest framing: a
 * lira bank balance grows fast in lira but the lira slid hard against the dollar,
 * so in dollars it lost ground — while a dollar-stable USDC position held and
 * grew. Compared in USDC, never raw lira (raw lira hides the depreciation).
 *
 * Real published data:
 *  - TRY_USD_2020: CBRT year-end 2020 USD/TRY.
 *  - CBRT_1Y_RATES: TCMB/CBRT published 1-year lira bank rates, year-end 2021–2025.
 * The live USD/TRY for "today" is fetched at call time (see usdTry.ts).
 */

/** CBRT year-end 2020 USD/TRY — the anchor for "5 years ago". */
export const TRY_USD_2020 = 7.4347;

/** TCMB/CBRT published 1-year lira bank rates, year-end 2021–2025 (real data). */
export const CBRT_1Y_RATES: readonly { readonly year: number; readonly rate: number }[] = [
  { year: 2021, rate: 0.17 },
  { year: 2022, rate: 0.18 },
  { year: 2023, rate: 0.25 },
  { year: 2024, rate: 0.5 },
  { year: 2025, rate: 0.45 },
];

/** Latest published 1-year lira bank rate (the headline "vs Turkish bank" figure). */
export const CBRT_CURRENT_1Y_RATE = CBRT_1Y_RATES[CBRT_1Y_RATES.length - 1]?.rate ?? 0.45;

/** Years of real data the comparison spans (one CBRT rate per year). */
export const COMPARISON_YEARS = CBRT_1Y_RATES.length;

/** Compounded lira growth over the window (≈ 3.75× across 2021–2025). */
export function bankMultiplier(rates: readonly { rate: number }[] = CBRT_1Y_RATES): number {
  return rates.reduce((acc, r) => acc * (1 + r.rate), 1);
}

export interface ComparisonInput {
  /** The user's principal, in USDC (the calculator's unit). */
  readonly principalUsd: number;
  /** Live USD/TRY rate for "today". */
  readonly tryRateNow: number;
  /** Sava rate to model, percent (the live Blend testnet APY). */
  readonly savaApyPct: number;
}

export interface Comparison {
  readonly years: number;
  /** Principal in dollars (the baseline every outcome is measured against). */
  readonly startUsd: number;
  /** The lira that principal was worth 5 years ago (nominal lira anchor). */
  readonly liraThen: number;
  /** Lira balance a bank would show today (nominal lira — looks big). */
  readonly bankLiraNow: number;
  /** That bank balance converted to dollars today (the real story). */
  readonly bankUsd: number;
  /** Same lira held as cash → dollars today. */
  readonly cashUsd: number;
  /** USDC at the Sava rate, compounded over the window. */
  readonly savaUsd: number;
  /** Dollar change vs the start (negative = lost dollars). */
  readonly bankDeltaUsd: number;
  readonly cashDeltaUsd: number;
  readonly savaDeltaUsd: number;
  readonly bankPct: number;
  readonly cashPct: number;
  readonly savaPct: number;
}

/**
 * Compare the same starting dollars across three homes over the real 5-year
 * window: cash, a Turkish bank (lira at CBRT rates), and Sava (USDC at the live
 * rate). Pure — the caller supplies the live USD/TRY and Sava APY.
 */
export function compareBankVsSava(inp: ComparisonInput): Comparison {
  const years = COMPARISON_YEARS;
  const startUsd = Math.max(0, inp.principalUsd);
  const liraThen = startUsd * TRY_USD_2020;
  const bankLiraNow = liraThen * bankMultiplier();
  const tryRate = inp.tryRateNow > 0 ? inp.tryRateNow : TRY_USD_2020;
  const bankUsd = bankLiraNow / tryRate;
  const cashUsd = liraThen / tryRate;
  const savaUsd = startUsd * (1 + inp.savaApyPct / 100) ** years;

  const pct = (end: number) => (startUsd > 0 ? (end / startUsd - 1) * 100 : 0);
  return {
    years,
    startUsd,
    liraThen,
    bankLiraNow,
    bankUsd,
    cashUsd,
    savaUsd,
    bankDeltaUsd: bankUsd - startUsd,
    cashDeltaUsd: cashUsd - startUsd,
    savaDeltaUsd: savaUsd - startUsd,
    bankPct: pct(bankUsd),
    cashPct: pct(cashUsd),
    savaPct: pct(savaUsd),
  };
}
