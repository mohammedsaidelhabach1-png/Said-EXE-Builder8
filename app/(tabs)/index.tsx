import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Directory } from "expo-file-system";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const officialLinks = [
  ["قناة Internet Freebies على واتساب", "https://whatsapp.com/channel/0029Vb8DyrRInlqNzmWEYS1f"],
  ["مجموعة Internet Freebies على واتساب", "https://chat.whatsapp.com/Da9djciv5RW3jIhrphOV0?s=cl&p=a&ilr=0"],
  ["قناة Internet Freebies على YouTube", "https://youtube.com/@internetfreebies?si=HutYNTMM7D6c1zVC"],
  ["صفحتنا على Facebook", "https://www.facebook.com/share/1DP3FSiqzi/"],
  ["صفحتنا على Instagram", "https://www.instagram.com/_internet_freebies?igsh=a2YwN2ZkYzFnc2Ro"],
  ["صفحتنا على TikTok", "https://www.tiktok.com/@internet.freebies"],
  ["قناة Internet Freebies على Telegram", "https://t.me/internetfreebie"],
  ["التواصل عبر WhatsApp", "https://wa.me/212773131049"],
  ["القناة الرسمية للكونفيغات", "https://t.me/mohammed_said142"],
];
const packageOptions = ["APK", "EXE", "ملف مضغوط", "حزمة مخصصة"];
const libraryOptions = ["PySide6", "Pillow", "SpeechRecognition", "python-docx", "ReportLab", "PyInstaller", "pypdf", "pydub"];

type Project = { id: string; name: string; type: string; libraries: string[]; updated: string };

export default function HomeScreen() {
  const colors = useColors();
  const [page, setPage] = useState("الرئيسية");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>(["PyInstaller", "Pillow"]);
  const [selectedPackage, setSelectedPackage] = useState("EXE");
  const [outputName, setOutputName] = useState("SaidEXE");
  const [saveDirectoryUri, setSaveDirectoryUri] = useState<string | null>(null);
  const [saveDirectoryName, setSaveDirectoryName] = useState("");
  const [pythonFile, setPythonFile] = useState<{ name: string; uri: string } | null>(null);
  const startBuildMutation = trpc.github.startBuild.useMutation();
  const downloadArtifactMutation = trpc.github.downloadArtifact.useMutation();
  const cancelBuildMutation = trpc.github.cancelBuild.useMutation();
  const startApkBuildMutation = trpc.github.startApkBuild.useMutation();
  const downloadApkMutation = trpc.github.downloadApk.useMutation();
  const statusQuery = trpc.github.checkStatus.useQuery(undefined, { enabled: false });
  const apkStatusQuery = trpc.github.checkApkStatus.useQuery(undefined, { enabled: false });
  const [projectName, setProjectName] = useState("");
  const [dark, setDark] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [timerId, setTimerId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [apkBuilding, setApkBuilding] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [apkStage, setApkStage] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("said-exe-projects").then((value) => value && setProjects(JSON.parse(value)));
    AsyncStorage.getItem("said-exe-settings").then((value) => {
      if (value) { const saved = JSON.parse(value); setDark(saved.dark ?? true); setNotifications(saved.notifications ?? true); setSaveDirectoryUri(saved.saveDirectoryUri ?? null); setSaveDirectoryName(saved.saveDirectoryName ?? ""); }
    });
  }, []);
  useEffect(() => { AsyncStorage.setItem("said-exe-projects", JSON.stringify(projects)); }, [projects]);
  useEffect(() => { AsyncStorage.setItem("said-exe-settings", JSON.stringify({ dark, notifications, saveDirectoryUri, saveDirectoryName })); }, [dark, notifications, saveDirectoryUri, saveDirectoryName]);

  const accent = colors.tint;
  const createProject = () => {
    if (!projectName.trim()) { Alert.alert("اسم المشروع", "اكتب اسم المشروع أولاً"); return; }
    const item = { id: Date.now().toString(), name: projectName.trim(), type: selectedPackage, libraries: selectedLibraries, updated: "الآن" };
    setProjects((current) => [item, ...current]); setProjectName("");
    Alert.alert("تم إنشاء المشروع", "أصبح المشروع جاهزاً لإضافة المكتبات والبناء.");
  };
  const toggleLibrary = (name: string) => setSelectedLibraries((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
  const pickPythonFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/x-python", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith(".py")) { Alert.alert("ملف غير صالح", "اختر ملف Python بامتداد .py"); return; }
      setPythonFile({ name: asset.name, uri: asset.uri });
    } catch { Alert.alert("تعذر اختيار الملف", "حاول مرة أخرى."); }
  };
  const pickSaveDirectory = async () => {
    try {
      const directory = await Directory.pickDirectoryAsync(saveDirectoryUri ?? undefined);
      setSaveDirectoryUri(directory.uri);
      const parts = directory.uri.split("/").filter(Boolean);
      setSaveDirectoryName(parts[parts.length - 1] || "المجلد المختار");
      Alert.alert("تم اختيار المجلد", "سيُحفظ ملف EXE القادم في هذا المجلد.");
    } catch { Alert.alert("تعذر اختيار المجلد", "حاول مرة أخرى ومنح التطبيق صلاحية الوصول للمجلد."); }
  };
  const downloadResult = async (url: string) => {
    try {
      setProgress(84); setProgressStage("جارٍ تنزيل النتيجة…");
      const result = await downloadArtifactMutation.mutateAsync({ url });
      setProgress(94); setProgressStage("جارٍ فك الضغط والحفظ…");
      if (!FileSystem.documentDirectory) throw new Error("مساحة الحفظ غير متاحة");
      const cleanedName = outputName.trim().replace(/\.exe$/i, "").replace(/[<>:"/\\|?*]/g, "").slice(0, 60) || "SaidEXE";
      const finalName = `${cleanedName}.exe`;
      if (saveDirectoryUri) {
        const directory = new Directory(saveDirectoryUri);
        const target = directory.createFile(finalName, "application/vnd.microsoft.portable-executable");
        const binary = atob(result.content);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        target.write(bytes);
      } else {
        const destination = `${FileSystem.documentDirectory}${finalName}`;
        await FileSystem.writeAsStringAsync(destination, result.content, { encoding: FileSystem.EncodingType.Base64 });
      }
      setProgress(100); setBuilding(false); setActiveRunId(null);
      Alert.alert("تم التنزيل", `تم فك الضغط وحفظ ${finalName} داخل ملفات التطبيق.`);
    } catch { setBuilding(false); Alert.alert("تعذر التنزيل", "اكتمل البناء، لكن تعذر فك الضغط أو حفظ ملف EXE داخل الهاتف."); }
  };
  const cancelBuild = async () => {
    if (timerId) { clearInterval(timerId); setTimerId(null); }
    try {
      if (activeRunId) await cancelBuildMutation.mutateAsync({ runId: activeRunId });
      setActiveRunId(null); setBuilding(false); setProgress(0); setProgressStage("");
      Alert.alert("تم الإلغاء", activeRunId ? "تم إيقاف مهمة البناء على الخادم." : "تم إلغاء العملية قبل بدء البناء.");
    } catch { setBuilding(false); Alert.alert("تعذر الإلغاء", "توقفت المتابعة داخل التطبيق، لكن تعذر إرسال طلب الإلغاء إلى الخادم."); }
  };
  const startApkBuild = async () => {
    try {
      setApkBuilding(true); setApkProgress(10); setApkStage("جارٍ بدء تجهيز APK…");
      await startApkBuildMutation.mutateAsync();
      setApkProgress(22); setApkStage("جارٍ إنشاء APK…");
      const timer = setInterval(async () => {
        const response = await apkStatusQuery.refetch();
        const data = response.data;
        if (data?.status === "completed" && data.conclusion === "success") {
          clearInterval(timer); setApkProgress(82); setApkStage("اكتمل التجهيز، جارٍ التنزيل…");
          if (data.downloadUrl) {
            const result = await downloadApkMutation.mutateAsync({ url: data.downloadUrl });
            const finalName = "SaidEXE.apk";
            if (saveDirectoryUri) {
              const directory = new Directory(saveDirectoryUri);
              const target = directory.createFile(finalName, "application/vnd.android.package-archive");
              const binary = atob(result.content);
              target.write(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
            } else if (FileSystem.documentDirectory) {
              await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${finalName}`, result.content, { encoding: FileSystem.EncodingType.Base64 });
            }
            setApkProgress(100); setApkStage("تم حفظ APK بنجاح"); setApkBuilding(false);
            Alert.alert("اكتمل البناء", "تم حفظ ملف APK داخل الهاتف.");
          } else { clearInterval(timer); setApkBuilding(false); Alert.alert("اكتمل البناء", "تم تجهيز APK، لكن رابط التنزيل غير متاح بعد."); }
        }
        if (data?.status === "completed" && data.conclusion !== "success") { clearInterval(timer); setApkBuilding(false); setApkStage("تعذر إنشاء APK"); Alert.alert("تعذر البناء", "لم تكتمل عملية إنشاء APK."); }
      }, 6000);
    } catch { setApkBuilding(false); setApkStage("تعذر بدء البناء"); Alert.alert("تعذر البناء", "تحقق من الاتصال ثم حاول مرة أخرى."); }
  };
  const startBuild = async () => {
    if (!pythonFile) { Alert.alert("اختر ملف Python", "اختر ملف الكود أولاً لبدء التجهيز."); return; }
    if (!projects.length) { Alert.alert("لا يوجد مشروع", "أنشئ مشروعاً من صفحة المشاريع أولاً."); return; }
    try {
      setBuilding(true); setProgress(8); setProgressStage("جارٍ رفع ملف Python…");
      const content = await FileSystem.readAsStringAsync(pythonFile.uri, { encoding: FileSystem.EncodingType.Base64 });
      const buildResult = await startBuildMutation.mutateAsync({ fileName: pythonFile.name, content });
      setActiveRunId(buildResult.runId); setProgress(18); setProgressStage("جارٍ بناء ملف EXE على Windows…");
      Alert.alert("بدأ البناء", "تم إرسال ملف Python إلى Windows وسيتم تحديث الحالة تلقائياً.");
      const timer = setInterval(async () => {
        const response = await statusQuery.refetch();
        const data = response.data;
        if (data?.status === "completed") { clearInterval(timer); setTimerId(null); setActiveRunId(null); setProgress(78); setProgressStage("اكتمل البناء، جارٍ تجهيز التنزيل…"); Alert.alert("اكتمل البناء", "تم تجهيز ملف EXE. هل تريد تنزيله الآن؟", [{ text: "تنزيل الآن", onPress: () => data.downloadUrl ? void downloadResult(data.downloadUrl) : Linking.openURL(data.url) }, { text: "لاحقاً", onPress: () => setBuilding(false) }]); }
        if (data?.status === "failed") { clearInterval(timer); setTimerId(null); setActiveRunId(null); setProgress(100); setProgressStage("تعذر إكمال البناء"); setBuilding(false); Alert.alert("تعذر البناء", "تحقق من ملف Python والمكتبات المطلوبة ثم حاول مرة أخرى."); }
      }, 5000);
      setTimerId(timer);
    } catch { setBuilding(false); Alert.alert("تعذر بدء البناء", "تحقق من اتصال الخدمة وإعدادات المستودع ثم حاول مرة أخرى."); }
  };

  const nav = ["الرئيسية", "المشاريع", "المكتبات", "البناء", "الإعدادات"];
  const title = useMemo(() => page === "الرئيسية" ? "مرحباً بك في Said EXE" : page, [page]);
  return <ScreenContainer edges={["top", "left", "right", "bottom"]} style={{ backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}><View><Text style={[styles.eyebrow, { color: accent }]}>SAID EXE</Text><Text style={[styles.title, { color: colors.foreground }]}>{title}</Text></View><View style={[styles.logo, { backgroundColor: accent }]}><Text style={styles.logoText}>S</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow} style={styles.navScroll}>
        {nav.map((item) => <Pressable key={item} onPress={() => setPage(item)} style={[styles.navItem, { backgroundColor: page === item ? accent : colors.surface }]}><Text style={{ color: page === item ? "#06111d" : colors.muted, fontWeight: "700" }}>{item}</Text></Pressable>)}
      </ScrollView>

      {page === "الرئيسية" && <>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.heroTitle, { color: colors.foreground }]}>كل أدواتك في مكان واحد</Text><Text style={[styles.body, { color: colors.muted }]}>أنشئ مشروعاً، اختر المكتبات، وجهّز الحزمة بخطوات واضحة.</Text><Pressable onPress={() => setPage("المشاريع")} style={[styles.primaryButton, { backgroundColor: accent }]}><Text style={styles.primaryText}>ابدأ مشروعاً جديداً</Text></Pressable></View>
        <View style={styles.stats}><Stat label="المشاريع" value={String(projects.length)} colors={colors}/><Stat label="المكتبات" value={String(selectedLibraries.length)} colors={colors}/><Stat label="الحالة" value="جاهز" colors={colors}/></View>
        <Section title="الوصول السريع" colors={colors}><Quick title="المشاريع" text="إدارة مشاريعك المحلية" onPress={() => setPage("المشاريع")} colors={colors}/><Quick title="المكتبات" text="حدد ما تحتاجه" onPress={() => setPage("المكتبات")} colors={colors}/><Quick title="البناء" text="جهّز الحزمة" onPress={() => setPage("البناء")} colors={colors}/></Section>
      </>}

      {page === "المشاريع" && <><Section title="إنشاء مشروع" colors={colors}><TextInput value={projectName} onChangeText={setProjectName} placeholder="اسم المشروع" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /><Text style={[styles.label, { color: colors.muted }]}>نوع الحزمة</Text><View style={styles.choiceWrap}>{packageOptions.map((item) => <Choice key={item} label={item} active={selectedPackage === item} onPress={() => setSelectedPackage(item)} colors={colors}/>)}</View><Pressable onPress={createProject} style={[styles.primaryButton, { backgroundColor: accent }]}><Text style={styles.primaryText}>إنشاء المشروع</Text></Pressable></Section><Section title="مشاريعك" colors={colors}>{projects.length === 0 ? <Text style={[styles.body, { color: colors.muted }]}>لا توجد مشاريع بعد.</Text> : projects.map((item) => <View key={item.id} style={[styles.project, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.body, { color: colors.muted }]}>{item.type} · {item.libraries.length} مكتبات · {item.updated}</Text></View><Pressable onPress={() => Alert.alert("حذف المشروع", "هل تريد حذف هذا المشروع؟", [{ text: "إلغاء" }, { text: "حذف", style: "destructive", onPress: () => setProjects((all) => all.filter((p) => p.id !== item.id)) }])}><Text style={{ color: colors.error, fontWeight: "700" }}>حذف</Text></Pressable></View>)}</Section></>}

      {page === "المكتبات" && <Section title="اختر المكتبات المطلوبة" colors={colors}><Text style={[styles.body, { color: colors.muted }]}>حدد أكثر من مكتبة لإضافتها إلى مشروعك.</Text>{libraryOptions.map((item) => <Pressable key={item} onPress={() => toggleLibrary(item)} style={[styles.checkRow, { borderBottomColor: colors.border }]}><View style={[styles.checkbox, { borderColor: selectedLibraries.includes(item) ? accent : colors.border, backgroundColor: selectedLibraries.includes(item) ? accent : "transparent" }]}>{selectedLibraries.includes(item) && <Text style={styles.check}>✓</Text>}</View><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item}</Text></Pressable>)}<Text style={[styles.selection, { color: accent }]}>{selectedLibraries.length} مكتبات محددة</Text></Section>}

      {page === "البناء" && <Section title="تجهيز الحزمة" colors={colors}><Text style={[styles.body, { color: colors.muted }]}>اختر المشروع ونوع الحزمة ثم ابدأ العملية.</Text><View style={[styles.codeCard, { backgroundColor: colors.background, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>ملف التجهيز الموحد</Text><Text style={[styles.body, { color: colors.muted }]}>build.py</Text></View><Pressable onPress={pickPythonFile} style={[styles.filePicker, { backgroundColor: colors.surface, borderColor: colors.tint }]}><Text style={[styles.cardTitle, { color: colors.tint }]}>{pythonFile ? "تغيير ملف Python" : "اختيار ملف Python"}</Text><Text style={[styles.body, { color: colors.muted }]}>{pythonFile ? pythonFile.name : "اختر ملفاً بامتداد .py من جهازك"}</Text></Pressable><Text style={[styles.label, { color: colors.muted }]}>اسم ملف EXE عند الحفظ</Text><TextInput value={outputName} onChangeText={setOutputName} placeholder="SaidEXE" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]} /><Pressable onPress={pickSaveDirectory} style={[styles.filePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>مجلد الحفظ</Text><Text style={[styles.body, { color: colors.muted }]}>{saveDirectoryName || "اختيار مجلد من الهاتف"}</Text></Pressable><Text style={[styles.label, { color: colors.muted }]}>المشروع</Text><View style={styles.choiceWrap}>{projects.map((item) => <Choice key={item.id} label={item.name} active={true} onPress={() => {}} colors={colors}/>)}</View><Text style={[styles.label, { color: colors.muted }]}>الصيغة</Text><View style={styles.choiceWrap}>{packageOptions.map((item) => <Choice key={item} label={item} active={selectedPackage === item} onPress={() => setSelectedPackage(item)} colors={colors}/>)}</View>{building && <View style={styles.progressBox}><Text style={[styles.body, { color: colors.foreground }]}>{progressStage || "جارٍ تجهيز الحزمة…"} {progress}%</Text><View style={[styles.progress, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accent }]} /></View><Pressable onPress={cancelBuild} style={{ marginTop: 12, alignSelf: "center" }}><Text style={{ color: colors.error, fontWeight: "700" }}>إلغاء العملية</Text></Pressable></View>}<Pressable disabled={building} onPress={startBuild} style={[styles.primaryButton, { backgroundColor: building ? colors.border : accent }]}><Text style={styles.primaryText}>{building ? "جارٍ العمل" : "بدء التجهيز"}</Text></Pressable><View style={styles.apkBuildBox}><Text style={[styles.label, { color: colors.muted }]}>إنشاء نسخة التطبيق</Text>{apkBuilding && <><Text style={[styles.body, { color: colors.foreground }]}>{apkStage} {apkProgress}%</Text><View style={[styles.progress, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${apkProgress}%`, backgroundColor: accent }]} /></View></>}<Pressable disabled={apkBuilding} onPress={startApkBuild} style={[styles.secondaryButton, { borderColor: accent, backgroundColor: colors.surface }]}><Text style={{ color: accent, fontWeight: "800" }}>{apkBuilding ? "جارٍ الإنشاء…" : "إنشاء APK عبر الهاتف"}</Text></Pressable></View></Section>}

      {page === "الإعدادات" && <><Section title="تفضيلات التطبيق" colors={colors}><Setting title="الوضع الداكن" description="مظهر مريح للاستخدام اليومي" value={dark} onValueChange={setDark} colors={colors}/><Setting title="الإشعارات" description="إظهار تنبيهات اكتمال العمليات" value={notifications} onValueChange={setNotifications} colors={colors}/></Section><Section title="الحقوق والقنوات" colors={colors}><Text style={[styles.body, { color: colors.muted }]}>© 2026 Said EXE وInternet Freebies</Text>{officialLinks.map(([label, url]) => <Pressable key={url} onPress={() => Linking.openURL(url)} style={[styles.link, { borderBottomColor: colors.border }]}><Text style={{ color: accent, fontWeight: "700" }}>{label}</Text><Text style={{ color: colors.muted }}>↗</Text></Pressable>)}</Section></>}
    </ScrollView>
  </ScreenContainer>;
}

function Section({ title, children, colors }: any) { return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>{children}</View>; }
function Stat({ label, value, colors }: any) { return <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.statValue, { color: colors.tint }]}>{value}</Text><Text style={[styles.body, { color: colors.muted }]}>{label}</Text></View>; }
function Quick({ title, text, onPress, colors }: any) { return <Pressable onPress={onPress} style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.body, { color: colors.muted }]}>{text}</Text></View><Text style={{ color: colors.tint, fontSize: 22 }}>‹</Text></Pressable>; }
function Choice({ label, active, onPress, colors }: any) { return <Pressable onPress={onPress} style={[styles.choice, { borderColor: active ? colors.tint : colors.border, backgroundColor: active ? colors.tint + "22" : colors.surface }]}><Text style={{ color: active ? colors.tint : colors.muted, fontWeight: "700" }}>{label}</Text></Pressable>; }
function Setting({ title, description, value, onValueChange, colors }: any) { return <View style={[styles.setting, { borderBottomColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.body, { color: colors.muted }]}>{description}</Text></View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.tint }} /> </View>; }

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 50 }, topRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }, eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "800", textAlign: "right" }, title: { fontSize: 27, fontWeight: "800", marginTop: 5, textAlign: "right" }, logo: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, logoText: { color: "#06111d", fontSize: 30, fontWeight: "900" }, navScroll: { marginBottom: 20 }, navRow: { gap: 8, flexDirection: "row-reverse" }, navItem: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18 }, hero: { borderWidth: 1, borderRadius: 24, padding: 22, marginBottom: 14 }, heroTitle: { fontSize: 23, fontWeight: "800", textAlign: "right" }, body: { fontSize: 13, lineHeight: 21, textAlign: "right", marginTop: 5 }, primaryButton: { padding: 15, borderRadius: 14, alignItems: "center", marginTop: 18 }, primaryText: { color: "#06111d", fontWeight: "800", fontSize: 15 }, stats: { flexDirection: "row", gap: 10, marginBottom: 15 }, stat: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, alignItems: "center" }, statValue: { fontSize: 22, fontWeight: "800" }, section: { marginTop: 12, marginBottom: 10 }, sectionTitle: { fontSize: 19, fontWeight: "800", textAlign: "right", marginBottom: 10 }, quick: { flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, padding: 15, borderRadius: 16, marginBottom: 9 }, cardTitle: { fontSize: 15, fontWeight: "700", textAlign: "right" }, input: { borderWidth: 1, borderRadius: 12, padding: 13, textAlign: "right", marginBottom: 15 }, label: { textAlign: "right", marginBottom: 8, marginTop: 3 }, choiceWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 8 }, choice: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }, project: { flexDirection: "row-reverse", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 9 }, checkRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: 1 }, checkbox: { width: 25, height: 25, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" }, check: { color: "#06111d", fontWeight: "900" }, selection: { textAlign: "right", fontWeight: "800", marginTop: 14 }, progressBox: { marginTop: 16 }, progress: { height: 10, borderRadius: 10, overflow: "hidden", marginTop: 10 }, progressFill: { height: "100%", borderRadius: 10 }, apkBuildBox: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#D7DEE6" }, secondaryButton: { padding: 14, borderRadius: 14, alignItems: "center", marginTop: 10, borderWidth: 1 }, codeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 }, filePicker: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 }, setting: { flexDirection: "row-reverse", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1 }, link: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1 },
});
