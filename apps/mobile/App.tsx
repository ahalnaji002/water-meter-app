import { useEffect, useMemo, useState } from "react";
import { Alert, I18nManager, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { AppState, calculate, canClosePeriod, closePeriod, createInitialState, formatNumber, numberValue } from "@water-meter/core";

const STORAGE_KEY = "water-meter-mobile-v1";
I18nManager.allowRTL(true);

export default function App() {
  const [state, setStateValue] = useState<AppState>(createInitialState);
  const [ready, setReady] = useState(false);
  const result = useMemo(() => calculate(state), [state]);

  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then(raw => { if (raw) setStateValue({ ...createInitialState(), ...JSON.parse(raw) }); }).finally(() => setReady(true)); }, []);
  const setState = (next: AppState) => { setStateValue(next); void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); };
  const patch = (values: Partial<AppState>) => setState({ ...state, ...values });
  const updateResident = (id: number, values: object) => patch({ residents: state.residents.map(row => row.id === id ? { ...row, ...values } : row) });

  const savePeriod = () => {
    const error = canClosePeriod(state, result); if (error) return Alert.alert("راجع البيانات", error);
    Alert.alert("حفظ الدورة", "سيتم ترحيل القراءات الحالية لتصبح السابقة.", [{ text: "إلغاء", style: "cancel" }, { text: "حفظ", onPress: () => { setState(closePeriod(state, result)); Alert.alert("تم", "تم حفظ الدورة وترحيل القراءات."); } }]);
  };
  if (!ready) return <SafeAreaView style={styles.loading}><Text>جاري تحميل البيانات…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>إدارة القراءة الشهرية</Text><Text style={styles.title}>حاسبة توزيع المياه</Text><Text style={styles.subtitle}>أدخل القراءات الحالية فقط، وسيتم ترحيلها تلقائيًا.</Text>
    <Section title="1  بيانات الدورة">
      <Input label="تاريخ القراءة" value={state.readingDate} onChangeText={readingDate => patch({ readingDate })}/>
      <Input label="قراءة الكهرباء السابقة" value={String(state.electricityPrevious)} editable={false}/>
      <Input label="قراءة الكهرباء الحالية" value={String(state.electricityCurrent)} numeric onChangeText={v => patch({ electricityCurrent: v === "" ? "" : numberValue(v) })}/>
      <View style={styles.inputRow}><View style={styles.flex}><Input label="سعر الكيلو (₪)" value={String(state.electricityPrice)} numeric onChangeText={v => patch({ electricityPrice: numberValue(v) })}/></View><View style={styles.flex}><Input label="الخصم (₪)" value={String(state.discount)} numeric onChangeText={v => patch({ discount: numberValue(v) })}/></View></View>
    </Section>
    <View style={styles.cards}><Card label="استهلاك الكهرباء" value={state.electricityCurrent === "" ? "—" : formatNumber(result.electricityUsage)} unit="كيلو"/><Card label="المبلغ بعد الخصم" value={state.electricityCurrent === "" ? "—" : formatNumber(result.netCost)} unit="شيكل"/><Card label="استهلاك المياه" value={formatNumber(result.waterUsage, 4)} unit="كوب" accent/><Card label="سعر الكوب" value={result.waterUsage > 0 ? formatNumber(result.cupPrice, 4) : "—"} unit="شيكل" dark/></View>
    <Section title="2  قراءات المياه">
      {result.rows.map((row, index) => <View key={row.id} style={styles.resident}>
        <View style={styles.residentHeader}><Text style={styles.residentName}>{index + 1}. {row.name}</Text><Text style={styles.previous}>السابقة: {formatNumber(row.previous, 4)}</Text></View>
        <TextInput style={styles.currentInput} value={String(row.current)} keyboardType="decimal-pad" placeholder="القراءة الحالية" onChangeText={v => updateResident(row.id, { current: v === "" ? "" : numberValue(v) })}/>
        <View style={styles.resultRow}><Text>الاستهلاك: <Text style={styles.bold}>{row.hasCurrent ? formatNumber(row.usage, 4) : "—"}</Text></Text><Text>المبلغ: <Text style={styles.bold}>{row.hasCurrent ? `${formatNumber(row.amount)} ₪` : "—"}</Text></Text></View>
      </View>)}
    </Section>
    {!!result.warnings.length && <Text style={styles.warning}>{result.warnings.join(" ")}</Text>}
    <Pressable style={styles.primary} onPress={savePeriod}><Text style={styles.primaryText}>حفظ الدورة وترحيل القراءات</Text></Pressable>
    <Section title="3  الدورات المحفوظة">{!state.history.length ? <Text style={styles.muted}>لا توجد دورات محفوظة بعد.</Text> : state.history.slice().reverse().map((item, i) => <View key={`${item.date}-${i}`} style={styles.history}><Text style={styles.bold}>{item.date}</Text><Text>{formatNumber(item.waterUsage, 4)} كوب</Text><Text style={styles.money}>{formatNumber(item.netCost)} ₪</Text></View>)}</Section>
    <Pressable style={styles.reset} onPress={() => Alert.alert("إعادة ضبط", "حذف جميع البيانات المحلية؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => setState(createInitialState()) }])}><Text style={styles.resetText}>إعادة ضبط جميع البيانات</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.panel}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Input({ label, numeric, ...props }: { label: string; numeric?: boolean } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, props.editable === false && styles.readonly]} textAlign="right" keyboardType={numeric ? "decimal-pad" : "default"} {...props}/></View>; }
function Card({ label, value, unit, accent, dark }: { label: string; value: string; unit: string; accent?: boolean; dark?: boolean }) { return <View style={[styles.card, accent && styles.accent, dark && styles.dark]}><Text style={[styles.cardLabel, dark && styles.darkMuted]}>{label}</Text><Text style={[styles.cardValue, dark && styles.white]}>{value}</Text><Text style={[styles.cardLabel, dark && styles.darkMuted]}>{unit}</Text></View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f3f7f6"},loading:{flex:1,alignItems:"center",justifyContent:"center"},container:{padding:18,paddingBottom:50},eyebrow:{color:"#12836f",fontWeight:"800",textAlign:"right"},title:{fontSize:34,fontWeight:"900",color:"#17332d",textAlign:"right",marginTop:4},subtitle:{color:"#6d817c",textAlign:"right",marginTop:6,marginBottom:18},panel:{backgroundColor:"#fff",borderColor:"#dbe7e3",borderWidth:1,borderRadius:18,padding:16,marginBottom:14},sectionTitle:{fontSize:18,fontWeight:"800",color:"#17332d",textAlign:"right",marginBottom:13},field:{marginBottom:11},label:{color:"#45615a",fontWeight:"700",textAlign:"right",fontSize:13,marginBottom:6},input:{borderColor:"#dbe7e3",borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:10,color:"#17332d",backgroundColor:"#fbfdfc"},readonly:{backgroundColor:"#edf2f0",color:"#687b76"},inputRow:{flexDirection:"row-reverse",gap:10},flex:{flex:1},cards:{flexDirection:"row-reverse",flexWrap:"wrap",gap:10,marginBottom:14},card:{width:"48%",backgroundColor:"#fff",borderColor:"#dbe7e3",borderWidth:1,borderRadius:16,padding:15},accent:{backgroundColor:"#d9f1ec"},dark:{backgroundColor:"#17332d",borderColor:"#17332d"},cardLabel:{color:"#6d817c",textAlign:"right"},cardValue:{fontSize:23,fontWeight:"900",color:"#17332d",textAlign:"right",marginVertical:4},white:{color:"#fff"},darkMuted:{color:"#c4d8d3"},resident:{borderTopColor:"#e4ece9",borderTopWidth:1,paddingVertical:13},residentHeader:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",marginBottom:8},residentName:{fontWeight:"800",color:"#17332d",textAlign:"right",flex:1},previous:{color:"#6d817c",fontSize:12},currentInput:{borderColor:"#dbe7e3",borderWidth:1,borderRadius:9,padding:9,textAlign:"right",backgroundColor:"#fbfdfc"},resultRow:{flexDirection:"row-reverse",justifyContent:"space-between",marginTop:8},bold:{fontWeight:"800"},money:{fontWeight:"900",color:"#12836f"},warning:{backgroundColor:"#fff4d8",borderColor:"#efd38b",borderWidth:1,color:"#6d5310",padding:13,borderRadius:12,textAlign:"right",marginBottom:12},primary:{backgroundColor:"#12836f",borderRadius:12,padding:15,marginBottom:14},primaryText:{color:"#fff",fontWeight:"900",textAlign:"center",fontSize:16},history:{flexDirection:"row-reverse",justifyContent:"space-between",paddingVertical:10,borderTopColor:"#e4ece9",borderTopWidth:1},muted:{color:"#6d817c",textAlign:"right"},reset:{padding:14},resetText:{color:"#b33a3a",fontWeight:"700",textAlign:"center"}
});
