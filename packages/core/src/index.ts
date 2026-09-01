export type NumericInput = number | "";

export interface Resident {
  id: number;
  name: string;
  previous: number;
  current: NumericInput;
}

export interface PeriodSummary {
  date: string;
  electricityUsage: number;
  waterUsage: number;
  netCost: number;
  cupPrice: number;
  discount: number;
  price: number;
}

export interface AppState {
  readingDate: string;
  electricityPrevious: number;
  electricityCurrent: NumericInput;
  electricityPrice: number;
  discount: number;
  residents: Resident[];
  history: PeriodSummary[];
}

export interface CalculatedResident extends Resident {
  hasCurrent: boolean;
  usage: number;
  amount: number;
}

export interface CalculationResult {
  electricityUsage: number;
  grossCost: number;
  netCost: number;
  waterUsage: number;
  cupPrice: number;
  rows: CalculatedResident[];
  warnings: string[];
}

const seedData: Array<[string, number]> = [
  ["د.يوسف المنسي", 203.9081], ["د.محمد شحتو", 213.5], ["أبو محمود أبو مذكور", 157.2],
  ["أبو حافظ الريس", 108.5], ["محمود حرب", 168.5], ["أحمد الناجي", 240.5],
  ["مجد الديراوي", 227.7], ["فادي عبيد", 152.7], ["أبو يوسف الهنداوي", 192.6],
  ["أبو عبد الله علي حسن", 73], ["م.جهاد حلس", 162.7], ["برهان الحلبي", 175.7],
  ["لؤي المدهون", 217.3], ["أبو أحمد الريس", 117.7], ["النعسان (معروف)", 67.9],
  ["أبو طارق جاد الله", 144.1], ["أبو جهاد حلس", 138.2], ["أبو ياسين الريس", 124],
  ["د.وائل بدير", 165.7], ["أبو هاني الخليلي", 61.4], ["أبو ساجد المصري", 328.4],
  ["م.ناصر العيلة", 104.7], ["د.أحمد السموني", 33.1], ["أبو مروان دغمش", 210.2],
  ["أبو محمد يونس", 68.3], ["محمد الخواص", 412.1]
];

export const today = () => new Date().toISOString().slice(0, 10);
export const numberValue = (value: NumericInput | string) => Number(value) || 0;

export function createInitialState(): AppState {
  return {
    readingDate: today(),
    electricityPrevious: 3369,
    electricityCurrent: "",
    electricityPrice: 35,
    discount: 0,
    residents: seedData.map(([name, previous], index) => ({ id: index + 1, name, previous, current: "" })),
    history: []
  };
}

export function calculate(state: AppState): CalculationResult {
  const electricityUsage = numberValue(state.electricityCurrent) - state.electricityPrevious;
  const grossCost = electricityUsage * state.electricityPrice;
  const netCost = grossCost - state.discount;
  const rows: CalculatedResident[] = state.residents.map(resident => {
    const hasCurrent = resident.current !== "";
    const usage = hasCurrent ? numberValue(resident.current) - resident.previous : 0;
    return { ...resident, hasCurrent, usage, amount: 0 };
  });
  const waterUsage = rows.reduce((sum, row) => sum + row.usage, 0);
  const cupPrice = waterUsage > 0 ? netCost / waterUsage : 0;
  rows.forEach(row => { row.amount = row.usage * cupPrice; });
  const warnings: string[] = [];
  if (state.electricityCurrent !== "" && electricityUsage < 0) warnings.push("قراءة الكهرباء الحالية أقل من السابقة.");
  if (netCost < 0) warnings.push("قيمة الخصم أكبر من تكلفة الكهرباء.");
  if (rows.some(row => row.hasCurrent && row.usage < 0)) warnings.push("توجد قراءة مياه حالية أقل من القراءة السابقة.");
  return { electricityUsage, grossCost, netCost, waterUsage, cupPrice, rows, warnings };
}

export function canClosePeriod(state: AppState, result = calculate(state)): string | null {
  if (state.electricityCurrent === "") return "أدخل قراءة الكهرباء الحالية.";
  const missing = result.rows.filter(row => !row.hasCurrent).length;
  if (missing) return `أكمل قراءات المياه. متبقي ${missing}.`;
  if (result.warnings.length) return result.warnings.join(" ");
  if (result.waterUsage <= 0) return "مجموع استهلاك المياه يجب أن يكون أكبر من صفر.";
  return null;
}

export function closePeriod(state: AppState, result = calculate(state)): AppState {
  const error = canClosePeriod(state, result);
  if (error) throw new Error(error);
  return {
    ...state,
    electricityPrevious: numberValue(state.electricityCurrent),
    electricityCurrent: "",
    discount: 0,
    residents: state.residents.map(row => ({ ...row, previous: numberValue(row.current), current: "" })),
    history: [...state.history, {
      date: state.readingDate, electricityUsage: result.electricityUsage, waterUsage: result.waterUsage,
      netCost: result.netCost, cupPrice: result.cupPrice, discount: state.discount, price: state.electricityPrice
    }]
  };
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
