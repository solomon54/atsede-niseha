// src/features/father/components/StudentProfileDetail.tsx
"use client";

import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Church,
  Compass,
  Copy,
  Cross,
  Edit3,
  Fingerprint,
  Flame,
  Globe,
  GraduationCap,
  History,
  Landmark,
  Loader2,
  LucideIcon,
  Mail,
  Map,
  MapPin,
  Mars,
  Phone,
  ShieldCheck,
  User,
  Venus,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { StudentRecord } from "@/shared/types";
import {
  ETHIOPIAN_GEOGRAPHY,
  ETHIOPIAN_LANGUAGES,
  UNIVERSITY_MASTER_MAP,
} from "@/shared/constants/ethiopianData";
import {
  academicProgressFromEntry,
  getTodayEthiopian,
} from "@/shared/utils/calendar/ethiopianCalendar";
import { cn } from "@/shared/utils/utils";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
export interface ExtendedStudentRecord extends StudentRecord {
  spiritualTitle?: string;
  gender: "MALE" | "FEMALE";
  college: string;
  entryYear: number;
  programDuration: number;
  region: string;
  zone: string;
  city: string;
  diocese: string;
  phone: string;
  language: string;
  birthDate: { day: number | string; month: number | string; year: number | string };
}

interface DetailCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: "amber" | "slate";
  children: React.ReactNode;
}

interface DataPointProps {
  icon: LucideIcon;
  label: string;
  value: string | number | undefined;
  isEthiopic?: boolean;
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function StudentProfileDetail({
  student,
  isFather = false,
}: {
  student: ExtendedStudentRecord;
  isFather?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [localStudent, setLocalStudent] = useState(student);

  const progress = academicProgressFromEntry(
    localStudent.entryYear ?? 0,
    localStudent.programDuration ?? 4,
    localStudent.gender ?? "MALE"
  );

  const graduationYear =
    localStudent.entryYear && localStudent.programDuration
      ? localStudent.entryYear + localStudent.programDuration
      : localStudent.entryYear
      ? localStudent.entryYear + 4  // default 4-year program if duration missing
      : null;

  const birthDateString = localStudent.birthDate
    ? `${localStudent.birthDate.day}/${localStudent.birthDate.month}/${localStudent.birthDate.year} ዓ.ም`
    : "---";

  const joinedDate = localStudent.createdAt
    ? new Date(localStudent.createdAt).toLocaleDateString("am-ET", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "---";

  const copyToClipboard = () => {
    if (!localStudent.eotcUid) return;
    navigator.clipboard.writeText(localStudent.eotcUid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-10 pb-20 px-0 sm:px-4 max-w-7xl mx-auto">

      {/* ── SACRED HEADER ──────────────────────────────── */}
      <section className="relative p-6 sm:p-12 rounded-sm sm:rounded-[3rem] bg-white border-b sm:border border-slate-100 shadow-sm overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Church size={200} />
        </div>

        <div className="flex flex-col items-center gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative group">
            <div className="absolute inset-[-10px] rounded-full border-2 border-amber-200 animate-[pulse_3s_ease-in-out_infinite]" />
            <div className="absolute inset-[-20px] rounded-full border border-slate-200 shadow-inner" />
            <div className="w-38 h-38 sm:w-48 sm:h-48 rounded-full border-[3px] border-white shadow-2xl overflow-hidden bg-slate-50 relative z-10">
              {localStudent.photoUrl ? (
                <img src={localStudent.photoUrl} alt={localStudent.secularName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-200">
                  <User size={60} />
                </div>
              )}
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-slate-950 text-amber-400 rounded-full border border-amber-500/30 shadow-xl z-20 flex items-center gap-2 whitespace-nowrap">
              <Church size={12} className="text-amber-500" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em]">
                {localStudent.spiritualTitle || "ምዕመን"}
              </span>
            </div>
          </div>

          {/* Name block */}
          <div className="text-center space-y-3 mt-6 w-full max-w-sm">
            <h1 className="text-2xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-tight break-words">
              {localStudent.secularName}
            </h1>
            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
              <span className="text-lg sm:text-2xl font-bold text-amber-600 font-ethiopic">
                {localStudent.christianName}
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors active:scale-95">
                <span className={cn(
                  "text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors",
                  copied ? "text-emerald-600" : "text-slate-500"
                )}>
                  {copied ? "ተቀድቷል ✓" : localStudent.eotcUid}
                </span>
                <Copy size={10} className={copied ? "text-emerald-600" : "text-amber-600/50"} />
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <StatusBadge active={localStudent.accountClaimed} />
              <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-900 text-white flex items-center gap-1.5 border border-slate-800">
                {localStudent.gender === "MALE" ? <Mars size={10} /> : <Venus size={10} />}
                {localStudent.gender === "MALE" ? "ወንድ" : "ሴት"}
              </div>
            </div>

            {/* Edit button — after badges, never overlaps avatar */}
            {isFather && (
              <button
                onClick={() => setEditOpen(true)}
                className="mt-1 flex items-center gap-1.5 px-5 py-2 rounded-2xl bg-slate-900 text-amber-400 text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-colors shadow-md">
                <Edit3 size={12} />
                መረጃ አርትዕ
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── INFO BENTO ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

        {/* ACADEMIC */}
        <DetailCard title="የትምህርት መረጃ" subtitle="Academic Credentials" icon={GraduationCap} accent="slate">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <DataPoint icon={Landmark} label="ዩኒቨርሲቲ" value={localStudent.university} />
            <DataPoint icon={BookOpen} label="ኮሌጅ / ፋኩልቲ" value={localStudent.college} isEthiopic />
            <DataPoint icon={Zap} label="ዲፓርትመንት" value={localStudent.department} isEthiopic />
            <DataPoint
              icon={Calendar}
              label="ወደ ዩኒቨርሲቲ የገቡበት ዓ.ም"
              value={localStudent.entryYear ? `${localStudent.entryYear} ዓ.ም` : "—"}
            />
            <DataPoint
              icon={GraduationCap}
              label="የፕሮግራሙ ዓመታት"
              value={localStudent.programDuration ? `${localStudent.programDuration} ዓመት` : "—"}
            />
            {graduationYear && (
              <DataPoint
                icon={Calendar}
                label="የምረቃ ዓ.ም"
                value={`${graduationYear} ዓ.ም`}
              />
            )}

            {/* Standing banner */}
            {localStudent.entryYear ? (
              <div className={cn(
                "col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl border",
                progress.graduated ? "bg-emerald-50 border-emerald-200"
                  : progress.onBreak ? "bg-sky-50 border-sky-200"
                  : "bg-amber-50 border-amber-200"
              )}>
                <span className="text-xl shrink-0">
                  {progress.graduated ? "🎓" : progress.onBreak ? "☀️" : "📚"}
                </span>
                <div>
                  <p className={cn(
                    "text-[11px] font-black",
                    progress.graduated ? "text-emerald-800"
                      : progress.onBreak ? "text-sky-800"
                      : "text-amber-900"
                  )}>
                    {progress.label}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    ወቅታዊ ደረጃ — ከመዝገቡ ቀን ራሱ ይሰላል
                  </p>
                </div>
              </div>
            ) : (
              <div className="col-span-2 flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-[10px] font-bold">
                <Edit3 size={12} />
                {isFather
                  ? "የመዝገቡ ቀን ለማስገባት «መረጃ አርትዕ» ይጫኑ"
                  : "የመዝገቡ ቀን ገና አልተሞላም"}
              </div>
            )}
          </div>
        </DetailCard>

        {/* GEOGRAPHY */}
        <DetailCard title="የመኖሪያ አድራሻ" subtitle="Geographic Mapping" icon={MapPin} accent="amber">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <DataPoint icon={Compass} label="ክልል" value={localStudent.region} isEthiopic />
            <DataPoint icon={Map} label="ዞን / ክፍለ ከተማ" value={localStudent.zone} isEthiopic />
            <DataPoint icon={MapPin} label="ከተማ / አድራሻ" value={localStudent.city} isEthiopic />
            <DataPoint icon={Calendar} label="የትውልድ ቀን" value={birthDateString} />
          </div>
        </DetailCard>

        {/* CONTACT */}
        <DetailCard title="የመገናኛ መረጃ" subtitle="Digital Connectivity" icon={Phone} accent="slate">
          <div className="grid grid-cols-1 gap-3">
            <ContactRow icon={Phone} label="ስልክ" value={localStudent.phone} />
            <ContactRow icon={Mail} label="ኢሜይል" value={localStudent.email} />
            <ContactRow icon={Globe} label="ቋንቋ" value={localStudent.language} isEthiopic />
          </div>
        </DetailCard>

        {/* SPIRITUAL */}
        <DetailCard title="መንፈሳዊ ሁኔታ" subtitle="Spiritual Vitality" icon={Flame} accent="amber">
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 text-white flex items-center justify-between border border-amber-500/20 shadow-inner">
              <div className="flex items-center gap-3">
                <Cross className="text-amber-500" size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {localStudent.spiritualTitle || "ምዕመን"}
                </span>
              </div>
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                {localStudent.accountClaimed ? "ንቁ" : "በመጠባበቅ"}
              </span>
            </div>
          </div>
        </DetailCard>
      </div>

      {/* ── ETERNAL ARCHIVE ────────────────────────────── */}
      <section className="bg-slate-950 rounded-lg sm:rounded-[3rem] p-8 sm:p-16 text-white relative overflow-hidden border-t border-slate-800">
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center mb-12">
            <div className="p-4 rounded-full bg-white/5 border border-white/10 text-amber-500 mb-6 shadow-2xl">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-lg sm:text-xl font-black font-ethiopic leading-tight mb-4">
              ይህ መዝገብ ለዘለዓለም በአባትና ልጅ ምስጢር ሆኖ ይጠበቃል
            </h2>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">
              Eternal Sanctuary Protection
            </p>
          </div>
          <div className="space-y-8 mb-12">
            <TimelineItem
              date={joinedDate}
              title="መዝገብ ተከፈተ"
              desc="የልጁ ማንነት በዚህ ማኅደር ውስጥ ተመዘገበ።"
              icon={Fingerprint}
            />
            {progress.graduated && (
              <TimelineItem
                date={graduationYear ? `${graduationYear} ዓ.ም` : "ተምሯል/ተምራለች"}
                title={localStudent.gender === "FEMALE" ? "ትምህርቷን ጨርሳለች" : "ትምህርቱን ጨርሷል"}
                desc={localStudent.programDuration
                  ? `${localStudent.programDuration} ዓመት ፕሮግራም ተጠናቋል።`
                  : "ፕሮግራሙ ተጠናቋል።"}
                icon={GraduationCap}
              />
            )}
            <TimelineItem
              date="ግንኙነት"
              title="መንፈሳዊ ቃል ኪዳን"
              desc="በተመደቡት መምህረ ንስሐ የተረጋገጠ።"
              icon={History}
              isLast
            />
          </div>
        </div>
      </section>

      {/* ── FULL PROFILE EDIT PANEL (Father only) ─────── */}
      {isFather && editOpen && (
        <FullProfileEditPanel
          student={localStudent}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setLocalStudent((prev) => ({ ...prev, ...updated }));
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SECTION ACCORDION — defined OUTSIDE panel
   so React never remounts it on form state change
══════════════════════════════════════════════ */
function AccordionSection({
  id,
  openSection,
  onToggle,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  openSection: string;
  onToggle: (id: string) => void;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const isOpen = openSection === id;
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-amber-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{title}</span>
        </div>
        {isOpen
          ? <ChevronDown size={14} className="text-slate-400" />
          : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-5 py-4 space-y-4 bg-white">{children}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   FULL PROFILE EDIT PANEL
   Full-screen slide-over, Father-only.
══════════════════════════════════════════════ */
type EditForm = {
  secularName: string;
  christianName: string;
  gender: "MALE" | "FEMALE";
  spiritualTitle: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  region: string;
  zone: string;
  city: string;
  diocese: string;
  university: string;
  college: string;
  department: string;
  entryYear: string;
  programDuration: string;
  phone: string;
  email: string;
  language: string;
};

function FullProfileEditPanel({
  student,
  onClose,
  onSaved,
}: {
  student: ExtendedStudentRecord;
  onClose: () => void;
  onSaved: (updated: Partial<ExtendedStudentRecord>) => void;
}) {
  const currentEthYear = getTodayEthiopian().year;
  const entryYears = Array.from({ length: 30 }, (_, i) => currentEthYear - i);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>("identity");

  const [form, setForm] = useState<EditForm>({
    secularName:    student.secularName  ?? "",
    christianName:  student.christianName ?? "",
    gender:         student.gender        ?? "MALE",
    spiritualTitle: student.spiritualTitle ?? "",
    birthDay:       String(student.birthDate?.day   ?? ""),
    birthMonth:     String(student.birthDate?.month ?? ""),
    birthYear:      String(student.birthDate?.year  ?? ""),
    region:         student.region    ?? "",
    zone:           student.zone      ?? "",
    city:           student.city      ?? "",
    diocese:        student.diocese   ?? "",
    university:     student.university ?? "",
    college:        student.college   ?? "",
    department:     student.department ?? "",
    entryYear:      String(student.entryYear      ?? ""),
    programDuration: String(student.programDuration ?? "4"),
    phone:    student.phone    ?? "",
    email:    student.email    ?? "",
    language: student.language ?? "",
  });

  // Cascading zone options
  const zoneOptions = form.region ? (ETHIOPIAN_GEOGRAPHY[form.region] ?? []) : [];

  // Cascading college/dept options
  const collegeOptions = form.university
    ? Object.keys(UNIVERSITY_MASTER_MAP[form.university as keyof typeof UNIVERSITY_MASTER_MAP] ?? {})
    : [];
  const deptOptions = form.university && form.college
    ? ((UNIVERSITY_MASTER_MAP[form.university as keyof typeof UNIVERSITY_MASTER_MAP] as any)?.[form.college] ?? [])
    : [];

  const set = (key: keyof EditForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Live academic preview
  const entryYearNum = Number(form.entryYear) || 0;
  const progDurNum = Number(form.programDuration) || 4;
  const preview = entryYearNum
    ? academicProgressFromEntry(entryYearNum, progDurNum, form.gender)
    : null;
  const gradYearPreview = entryYearNum && progDurNum ? entryYearNum + progDurNum : null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        secularName:    form.secularName    || undefined,
        christianName:  form.christianName  || undefined,
        gender:         form.gender,
        spiritualTitle: form.spiritualTitle || undefined,
        region:         form.region         || undefined,
        zone:           form.zone           || undefined,
        city:           form.city           || undefined,
        diocese:        form.diocese        || undefined,
        university:     form.university     || undefined,
        college:        form.college        || undefined,
        department:     form.department     || undefined,
        phone:          form.phone          || undefined,
        email:          form.email          || undefined,
        language:       form.language       || undefined,
      };

      if (form.entryYear)      payload.entryYear      = Number(form.entryYear);
      if (form.programDuration) payload.programDuration = Number(form.programDuration);

      if (form.birthDay && form.birthMonth && form.birthYear) {
        payload.birthDate = {
          day:   Number(form.birthDay),
          month: Number(form.birthMonth),
          year:  Number(form.birthYear),
        };
      }

      const res = await fetch(`/api/father/children/${student.eotcUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ማስቀመጥ አልተሳካም");

      // Build the updated partial for optimistic UI
      const updated: Partial<ExtendedStudentRecord> = {
        secularName:    form.secularName   || student.secularName,
        christianName:  form.christianName || student.christianName,
        gender:         form.gender,
        spiritualTitle: form.spiritualTitle || student.spiritualTitle,
        region:         form.region   || student.region,
        zone:           form.zone     || student.zone,
        city:           form.city     || student.city,
        diocese:        form.diocese  || student.diocese,
        university:     form.university || student.university,
        college:        form.college    || student.college,
        department:     form.department || student.department,
        entryYear:      Number(form.entryYear) || student.entryYear,
        programDuration: Number(form.programDuration) || student.programDuration,
        phone:    form.phone    || student.phone,
        email:    form.email    || student.email,
        language: form.language || student.language,
      };
      if (form.birthDay && form.birthMonth && form.birthYear) {
        updated.birthDate = {
          day:   Number(form.birthDay),
          month: Number(form.birthMonth),
          year:  Number(form.birthYear),
        };
      }
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ስህተት ተፈጥሯል");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => setOpenSection((prev) => (prev === id ? "" : id));

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — slides in from right */}
      <div className="relative ml-auto w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              <Edit3 size={14} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[12px] font-black uppercase tracking-widest text-slate-900">
                የልጁ መረጃ አርትዕ
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">
                ለአባት ብቻ · {student.secularName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 transition-colors text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">

          {/* ── IDENTITY ── */}
          <AccordionSection id="identity" openSection={openSection} onToggle={toggle} title="የማንነት መረጃ" icon={User}>
            <EditField label="የዓለም ስም (ሙሉ ስም)" value={form.secularName}
              onChange={(v) => set("secularName", v)} placeholder="ሙሉ ስም" />
            <div className="grid grid-cols-2 gap-3">
              <EditField label="ስመ ክርስትና" value={form.christianName}
                onChange={(v) => set("christianName", v)} placeholder="ስመ ክርስትና" />
              <EditSelect label="ጾታ" value={form.gender}
                onChange={(v) => set("gender", v as "MALE" | "FEMALE")}
                options={[{ value: "MALE", label: "ወንድ" }, { value: "FEMALE", label: "ሴት" }]} />
            </div>
            <EditSelect label="መንፈሳዊ ማዕረግ" value={form.spiritualTitle}
              onChange={(v) => set("spiritualTitle", v)}
              options={[
                { value: "", label: "— ይምረጡ —" },
                { value: "ምዕመን", label: "ምዕመን" },
                { value: "ዲያቆን", label: "ዲያቆን" },
                { value: "ዘማሪ", label: "ዘማሪ" },
                { value: "ሰባኪ", label: "ሰባኪ" },
              ]} />
            <div>
              <label className="edit-label">የትውልድ ቀን (ዓ.ም)</label>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" placeholder="ቀን" value={form.birthDay}
                  onChange={(e) => set("birthDay", e.target.value)} className="edit-input text-center" />
                <input type="number" placeholder="ወር" value={form.birthMonth}
                  onChange={(e) => set("birthMonth", e.target.value)} className="edit-input text-center" />
                <input type="number" placeholder="ዓ.ም" value={form.birthYear}
                  onChange={(e) => set("birthYear", e.target.value)} className="edit-input text-center" />
              </div>
            </div>
          </AccordionSection>

          {/* ── ACADEMIC ── */}
          <AccordionSection id="academic" openSection={openSection} onToggle={toggle} title="የትምህርት መረጃ" icon={GraduationCap}>
            <EditField label="ዩኒቨርሲቲ" value={form.university}
              onChange={(v) => {
                set("university", v);
                set("college", "");
                set("department", "");
              }} placeholder="ዩኒቨርሲቲ" list="univ-list" />
            <datalist id="univ-list">
              {Object.keys(UNIVERSITY_MASTER_MAP).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>

            <EditField label="ኮሌጅ / ፋኩልቲ" value={form.college}
              onChange={(v) => { set("college", v); set("department", ""); }}
              placeholder="ኮሌጅ" list="college-list" />
            <datalist id="college-list">
              {collegeOptions.map((c) => <option key={c} value={c} />)}
            </datalist>

            <EditField label="ዲፓርትመንት" value={form.department}
              onChange={(v) => set("department", v)}
              placeholder="ዲፓርትመንት" list="dept-list" />
            <datalist id="dept-list">
              {deptOptions.map((d: string) => <option key={d} value={d} />)}
            </datalist>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="edit-label">ወደ ዩኒ የገቡበት ዓ.ም</label>
                <select value={form.entryYear} onChange={(e) => set("entryYear", e.target.value)}
                  className="edit-input">
                  <option value="">— ይምረጡ —</option>
                  {entryYears.map((y) => (
                    <option key={y} value={y}>{y} ዓ.ም</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="edit-label">የፕሮግራሙ ዓመታት</label>
                <select value={form.programDuration} onChange={(e) => set("programDuration", e.target.value)}
                  className="edit-input">
                  {[2, 3, 4, 5, 6, 7, 8].map((y) => (
                    <option key={y} value={y}>{y} ዓመት</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live academic preview */}
            {preview && (
              <div className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-[10px] font-bold",
                preview.graduated
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              )}>
                <span>{preview.graduated ? "🎓" : "📚"}</span>
                <span className="flex-1">{preview.label}</span>
                {gradYearPreview && (
                  <span className="text-slate-400 font-normal">ምረቃ {gradYearPreview} ዓ.ም</span>
                )}
              </div>
            )}
          </AccordionSection>

          {/* ── GEOGRAPHY ── */}
          <AccordionSection id="geography" openSection={openSection} onToggle={toggle} title="የመኖሪያ አድራሻ" icon={MapPin}>
            <div>
              <label className="edit-label">ክልል</label>
              <select value={form.region}
                onChange={(e) => { set("region", e.target.value); set("zone", ""); }}
                className="edit-input">
                <option value="">— ይምረጡ —</option>
                {Object.keys(ETHIOPIAN_GEOGRAPHY).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="edit-label">ዞን / ክፍለ ከተማ</label>
              <select value={form.zone} onChange={(e) => set("zone", e.target.value)}
                className="edit-input" disabled={!form.region}>
                <option value="">— ይምረጡ —</option>
                {zoneOptions.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <EditField label="ከተማ / አድራሻ" value={form.city}
              onChange={(v) => set("city", v)} placeholder="ከተማ" />
            <EditField label="ሀገረ ስብከት" value={form.diocese}
              onChange={(v) => set("diocese", v)} placeholder="ሀገረ ስብከት" />
          </AccordionSection>

          {/* ── CONTACT ── */}
          <AccordionSection id="contact" openSection={openSection} onToggle={toggle} title="የመገናኛ መረጃ" icon={Phone}>
            <EditField label="ስልክ" value={form.phone}
              onChange={(v) => set("phone", v)} placeholder="+2519…" />
            <EditField label="ኢሜይል" value={form.email}
              onChange={(v) => set("email", v)} placeholder="email@example.com" />
            <div>
              <label className="edit-label">ቋንቋ</label>
              <select value={form.language} onChange={(e) => set("language", e.target.value)}
                className="edit-input">
                <option value="">— ይምረጡ —</option>
                {ETHIOPIAN_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </AccordionSection>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
              <X size={12} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-4 bg-white flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 border border-slate-200 hover:border-slate-300 transition-colors">
            ሰርዝ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-slate-900 text-amber-400 text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? "በሂደት ላይ…" : "አስቀምጥ"}
          </button>
        </div>
      </div>

      {/* Scoped styles */}
      <style jsx global>{`
        .edit-label {
          display: block;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8;
          margin-bottom: 4px;
        }
        .edit-input {
          width: 100%;
          padding: 9px 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          color: #1e293b;
          transition: all 0.15s;
          appearance: auto;
        }
        .edit-input:focus {
          background: #fff;
          border-color: #fbbf24;
          box-shadow: 0 0 0 3px rgba(251,191,36,0.15);
          outline: none;
        }
        .edit-input:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SMALL HELPERS
───────────────────────────────────────────── */
function EditField({
  label, value, onChange, placeholder, list,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; list?: string }) {
  return (
    <div>
      <label className="edit-label">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list}
        className="edit-input"
      />
    </div>
  );
}

function EditSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="edit-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="edit-input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ─────────────────────────────────────────────
   VIEW COMPONENTS
───────────────────────────────────────────── */
function DetailCard({ title, subtitle, icon: Icon, accent, children }: DetailCardProps) {
  return (
    <div className="bg-white border-y sm:border border-slate-100 rounded-lg sm:rounded-[2.5rem] p-6 sm:p-10 shadow-sm transition-all hover:shadow-md">
      <header className="flex items-center gap-4 mb-8">
        <div className={cn(
          "p-3 rounded-2xl shadow-sm",
          accent === "amber" ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
        )}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 font-ethiopic leading-none truncate">{title}</h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">{subtitle}</p>
        </div>
      </header>
      {children}
    </div>
  );
}

function DataPoint({ icon: Icon, label, value, isEthiopic }: DataPointProps) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={12} strokeWidth={2.5} />
        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest truncate">{label}</span>
      </div>
      <p className={cn("text-sm font-bold text-slate-900 truncate", isEthiopic && "font-ethiopic text-[16px]")}>
        {value || "---"}
      </p>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, isEthiopic }: {
  icon: LucideIcon; label: string; value: string | undefined; isEthiopic?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{label}</p>
        <p className={cn("text-sm font-bold text-slate-900 truncate", isEthiopic && "font-ethiopic")}>
          {value || "---"}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <div className={cn(
      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
      active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
    )}>
      {active ? "● ንቁ" : "○ በመጠባበቅ"}
    </div>
  );
}

function TimelineItem({ date, title, desc, icon: Icon, isLast }: {
  date: string; title: string; desc: string; icon: LucideIcon; isLast?: boolean;
}) {
  return (
    <div className="flex gap-4 sm:gap-8 group">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
          <Icon size={20} />
        </div>
        {!isLast && <div className="w-px h-full bg-white/10 my-2" />}
      </div>
      <div className="pb-8">
        <span className="text-[9px] font-black text-amber-500 tracking-[0.2em] mb-1 block uppercase">{date}</span>
        <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed max-w-sm">{desc}</p>
      </div>
    </div>
  );
}
