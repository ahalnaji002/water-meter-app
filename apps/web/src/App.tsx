import { useMemo, useState } from "react";
import { AppState, calculate, canClosePeriod, closePeriod, createInitialState, formatNumber, numberValue } from "@water-meter/core";

const STORAGE_KEY = "water-meter-react-v1";
function load(): AppState { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? { ...createInitialState(), ...JSON.parse(raw) } : createInitialState(); } catch { return createInitialState(); } }

export default function App() {
  const [state, setStateValue] = useState<AppState>(load);
  const [message, setMessage] = useState("");
  const result = useMemo(() => calculate(state), [state]);
  const setState = (next: AppState) => { setStateValue(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const patch = (values: Partial<AppState>) => setState({ ...state, ...values });
  const updateResident = (id: number, values: object) => patch({ residents: state.residents.map(row => row.id === id ? { ...row, ...values } : row) });

  const savePeriod = () => {
    const error = canClosePeriod(state, result); if (error) { setMessage(error); return; }
    if (!confirm("حفظ الدورة وترحيل القراءات الحالية؟")) return;
    setState(closePeriod(state, result)); setMessage("تم حفظ الدورة وترحيل القراءات بنجاح.");
  };

  return <main className="shell">
    <header className="hero"><div><p className="eyebrow">إدارة القراءة الشهرية</p><h1>حاسبة توزيع المياه</h1><p>أدخل القراءات الحالية فقط، وسيتم حفظ السابقة وترحيلها تلقائيًا.</p></div><button className="danger" onClick={() => { if (confirm("حذف جميع البيانات المحلية؟")) setState(createInitialState()); }}>إعادة ضبط</button></header>
    <section className="panel"><div className="heading"><span>1</span><h2>بيانات الدورة</h2></div><div className="fields">
      <Field label="تاريخ القراءة"><input type="date" value={state.readingDate} onChange={e => patch({ readingDate: e.target.value })}/></Field>
      <Field label="قراءة الكهرباء السابقة"><input value={state.electricityPrevious} readOnly/></Field>
      <Field label="قراءة الكهرباء الحالية"><input type="number" step="0.01" value={state.electricityCurrent} onChange={e => patch({ electricityCurrent: e.target.value === "" ? "" : Number(e.target.value) })}/></Field>
      <Field label="سعر الكيلو (₪)"><input type="number" step="0.01" value={state.electricityPrice} onChange={e => patch({ electricityPrice: numberValue(e.target.value) })}/></Field>
      <Field label="الخصم (₪)"><input type="number" step="0.01" value={state.discount} onChange={e => patch({ discount: numberValue(e.target.value) })}/></Field>
    </div></section>
    <section className="cards">
      <Card label="استهلاك الكهرباء" value={state.electricityCurrent === "" ? "—" : formatNumber(result.electricityUsage)} unit="كيلو"/>
      <Card label="المبلغ بعد الخصم" value={state.electricityCurrent === "" ? "—" : formatNumber(result.netCost)} unit="شيكل"/>
      <Card label="استهلاك المياه" value={formatNumber(result.waterUsage, 4)} unit="كوب" accent/>
      <Card label="سعر كوب الماء" value={result.waterUsage > 0 ? formatNumber(result.cupPrice, 4) : "—"} unit="شيكل" dark/>
    </section>
    <section className="panel"><div className="heading"><span>2</span><h2>قراءات المياه</h2><button className="soft" onClick={() => patch({ residents: [...state.residents, { id: Date.now(), name: "مشترك جديد", previous: 0, current: "" }] })}>+ إضافة مشترك</button></div>
      <div className="tableWrap"><table><thead><tr><th>#</th><th>الاسم</th><th>السابقة</th><th>الحالية</th><th>الاستهلاك</th><th>المبلغ</th><th/></tr></thead><tbody>{result.rows.map((row, index) => <tr key={row.id}>
        <td>{index + 1}</td><td><input value={row.name} onChange={e => updateResident(row.id, { name: e.target.value })}/></td><td className="numeric">{formatNumber(row.previous, 4)}</td>
        <td><input className="numeric" type="number" step="0.0001" value={row.current} onChange={e => updateResident(row.id, { current: e.target.value === "" ? "" : Number(e.target.value) })}/></td>
        <td className="numeric">{row.hasCurrent ? formatNumber(row.usage, 4) : "—"}</td><td className="numeric">{row.hasCurrent ? formatNumber(row.amount) : "—"}</td>
        <td><button className="remove" onClick={() => patch({ residents: state.residents.filter(item => item.id !== row.id) })}>×</button></td></tr>)}</tbody>
        <tfoot><tr><td colSpan={4}>الإجمالي</td><td>{formatNumber(result.waterUsage, 4)}</td><td>{formatNumber(result.netCost)}</td><td/></tr></tfoot></table></div>
    </section>
    {(message || result.warnings.length > 0) && <p className={message.startsWith("تم") ? "success notice" : "warning notice"}>{message || result.warnings.join(" ")}</p>}
    <div className="actions"><button className="primary" onClick={savePeriod}>حفظ الدورة وترحيل القراءات</button><button className="secondary" onClick={() => window.print()}>طباعة الكشف</button></div>
    <section className="panel history"><div className="heading"><span>3</span><h2>الدورات المحفوظة</h2></div>{!state.history.length ? <p className="muted">لا توجد دورات محفوظة بعد.</p> : state.history.slice().reverse().map((item, i) => <article key={`${item.date}-${i}`}><b>{item.date}</b><span>{formatNumber(item.electricityUsage)} كيلو كهرباء</span><span>{formatNumber(item.waterUsage, 4)} كوب ماء</span><strong>{formatNumber(item.netCost)} ₪</strong></article>)}</section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label>{label}{children}</label>; }
function Card({ label, value, unit, accent, dark }: { label: string; value: string; unit: string; accent?: boolean; dark?: boolean }) { return <article className={`card ${accent ? "accent" : ""} ${dark ? "dark" : ""}`}><span>{label}</span><strong>{value}</strong><small>{unit}</small></article>; }
