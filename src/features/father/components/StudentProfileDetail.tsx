// src/features/father/components/StudentProfileDetail.tsx

"use client";

import {
  BookOpen,
  Calendar,
  Church,
  Compass,
  Copy,
  Cross,
  Fingerprint,
  Flame,
  Globe,
  GraduationCap,
  Hash,
  History,
  Landmark,
  LucideIcon,
  Mail,
  Map,
  MapPin,
  Mars,
  Phone,
  ShieldCheck,
  User,
  Venus,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { StudentRecord } from "@/shared/types";
import { cn } from "@/shared/utils/utils";

/**
 * EXTENDED TYPE BRIDGE
 * Intersecting your provided StudentRecord with the missing UI fields
 * to stop the TS compiler from screaming.
 */
interface ExtendedStudentRecord extends StudentRecord {
  spiritualTitle?: string;
  gender: "MALE" | "FEMALE";
  college: string;
  semester: number | string;
  region: string;
  zone: string;
  city: string;
  phone: string;
  language: string;
  birthDate: {
    day: number | string;
    month: number | string;
    year: number | string;
  };
}

// --- Component Prop Types ---
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

export default function StudentProfileDetail({
  student,
}: {
  student: ExtendedStudentRecord;
}) {
  const [copied, setCopied] = useState(false);

  // Safe check for birthDate to prevent runtime crash if data is partial
  const birthDateString = student.birthDate
    ? `${student.birthDate.day}/${student.birthDate.month}/${student.birthDate.year}`
    : "---";

  // Logic to handle the exact joined date from createdAt
  const joinedDate = student.createdAt
    ? new Date(student.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "---";

  const copyToClipboard = () => {
    if (!student.eotcUid) return;
    navigator.clipboard.writeText(student.eotcUid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-10 pb-20 px-0 sm:px-4 max-w-7xl mx-auto">
      {/* 1. THE SACRED HEADER */}
      <section className="relative p-6 sm:p-12 rounded-sm sm:rounded-[3rem] bg-white border-b sm:border border-slate-100 shadow-sm overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Church size={200} />
        </div>

        <div className="flex flex-col items-center gap-6 relative z-10">
          <div className="relative group">
            <div className="absolute inset-[-10px] rounded-full border-2 border-amber-200 animate-[pulse_3s_ease-in-out_infinite]" />
            <div className="absolute inset-[-20px] rounded-full border border-slate-200 shadow-inner" />

            <div className="w-38 h-38 sm:w-48 sm:h-48 rounded-full border-[3px] border-white shadow-2xl overflow-hidden bg-slate-50 relative z-10">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.secularName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-200">
                  <User size={60} />
                </div>
              )}
            </div>

            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-slate-950 text-amber-400 rounded-full border border-amber-500/30 shadow-xl z-20 flex items-center gap-2 whitespace-nowrap">
              <Church size={12} className="text-amber-500" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em]">
                {student.spiritualTitle || "ምዕመን"}
              </span>
            </div>
          </div>

          <div className="text-center space-y-3 mt-6 w-full max-w-sm">
            <h1 className="text-2xl sm:text-5xl font-black text-slate-900 tracking-tighter leading-tight break-words">
              {student.secularName}
            </h1>

            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
              <span className="text-lg sm:text-2xl font-bold text-amber-600 font-ethiopic">
                {student.christianName}
              </span>
              <div className="h-4 w-px bg-slate-300 hidden xs:block" />
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors active:scale-95">
                <span
                  className={cn(
                    "text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors",
                    copied ? "text-emerald-600" : "text-slate-500"
                  )}>
                  {copied ? "COPIED" : student.eotcUid}
                </span>
                <Copy
                  size={10}
                  className={copied ? "text-emerald-600" : "text-amber-600/50"}
                />
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <StatusBadge active={student.accountClaimed} />
              <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-900 text-white flex items-center gap-1.5 border border-slate-800">
                {student.gender === "MALE" ? (
                  <Mars size={10} />
                ) : (
                  <Venus size={10} />
                )}
                {student.gender === "MALE" ? " ወንድ (MALE)" : "ሴት (FEMALE)"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. INFORMATION BENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DetailCard
          title="የትምህርት መረጃ"
          subtitle="Academic Credentials"
          icon={GraduationCap}
          accent="slate">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <DataPoint
              icon={Landmark}
              label="Institution"
              value={student.university}
            />
            <DataPoint
              icon={BookOpen}
              label="Faculty"
              value={student.college}
              isEthiopic
            />
            <DataPoint
              icon={Zap}
              label="Department"
              value={student.department}
              isEthiopic
            />
            <div className="flex gap-4">
              <DataPoint
                icon={Calendar}
                label="Year"
                value={`${student.academicYear}ኛ ዓመት`}
              />
              <DataPoint
                icon={Hash}
                label="Semester"
                value={`${student.semester}ኛ ሴሚ`}
              />
            </div>
          </div>
        </DetailCard>

        <DetailCard
          title="የመኖሪያ አድራሻ"
          subtitle="Geographic Mapping"
          icon={MapPin}
          accent="amber">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <DataPoint
              icon={Compass}
              label="Region"
              value={student.region}
              isEthiopic
            />
            <DataPoint
              icon={Map}
              label="Zone / Subcity"
              value={student.zone}
              isEthiopic
            />
            <DataPoint
              icon={MapPin}
              label="Exact Address"
              value={student.city}
              isEthiopic
            />
            <DataPoint
              icon={Calendar}
              label="Birth Registry"
              value={`${birthDateString} ዓ.ም`}
            />
          </div>
        </DetailCard>

        <DetailCard
          title="የመገናኛ መረጃ"
          subtitle="Digital Connectivity"
          icon={Phone}
          accent="slate">
          <div className="grid grid-cols-1 gap-3">
            <ContactRow icon={Phone} label="Line 01" value={student.phone} />
            <ContactRow
              icon={Mail}
              label="Email Address"
              value={student.email}
            />
            <ContactRow
              icon={Globe}
              label="Native Tongue"
              value={student.language}
              isEthiopic
            />
          </div>
        </DetailCard>

        <DetailCard
          title="መንፈሳዊ ሁኔታ"
          subtitle="Spiritual Vitality"
          icon={Flame}
          accent="amber">
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-950 text-white flex items-center justify-between border border-amber-500/20 shadow-inner">
              <div className="flex items-center gap-3">
                <Cross className="text-amber-500" size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Confession State
                </span>
              </div>
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                VERIFIED
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <MiniStat label="Fasts" value="8/8" />
              <MiniStat label="Prayer" value="STREAK" />
              <MiniStat label="Alms" value="ACTIVE" />
            </div>
          </div>
        </DetailCard>
      </div>

      {/* 3. THE ETERNAL ARCHIVE */}
      <section className="bg-slate-950 rounded-lg sm:rounded-[3rem] p-8 sm:p-16 text-white relative overflow-hidden border-t border-slate-800">
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center mb-12">
            <div className="p-4 rounded-full bg-white/5 border border-white/10 text-amber-500 mb-6 shadow-2xl">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-lg sm:text-xl font-black font-ethiopic leading-tight mb-4 text-center">
              ይህ መዝገብ ለዘለዓለም በአባትና ልጅ ምስጢር ሆኖ ይጠበቃል
            </h2>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">
              Eternal Sanctuary Protection
            </p>
          </div>

          <div className="space-y-8 mb-12">
            <TimelineItem
              date={joinedDate}
              title="Record Created"
              desc="The child's data was officially entered into the digital diptychs."
              icon={Fingerprint}
            />
            <TimelineItem
              date="ግንኙነት"
              title="Spiritual Bond"
              desc="Successfully verified by the designated spiritual father."
              icon={History}
              isLast
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* --- REUSABLE UI COMPONENTS (STRICTLY TYPED) --- */

function DetailCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  children,
}: DetailCardProps) {
  return (
    <div className="bg-white border-y sm:border border-slate-100 rounded-lg sm:rounded-[2.5rem] p-6 sm:p-10 shadow-sm transition-all hover:shadow-md">
      <header className="flex items-center gap-4 mb-8">
        <div
          className={cn(
            "p-3 rounded-2xl shadow-sm",
            accent === "amber"
              ? "bg-amber-500 text-white"
              : "bg-slate-900 text-white"
          )}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 font-ethiopic leading-none truncate">
            {title}
          </h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">
            {subtitle}
          </p>
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
        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest truncate">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-bold text-slate-900 truncate",
          isEthiopic && "font-ethiopic text-[16px]"
        )}>
        {value || "---"}
      </p>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  isEthiopic,
}: {
  icon: LucideIcon;
  label: string;
  value: string | undefined;
  isEthiopic?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-bold text-slate-900 truncate",
            isEthiopic && "font-ethiopic"
          )}>
          {value || "---"}
        </p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center">
      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">
        {label}
      </p>
      <p className="text-[10px] font-black text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      )}>
      {active ? "● ACTIVE" : "○ PENDING"}
    </div>
  );
}

function TimelineItem({
  date,
  title,
  desc,
  icon: Icon,
  isLast,
}: {
  date: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  isLast?: boolean;
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
        <span className="text-[9px] font-black text-amber-500 tracking-[0.2em] mb-1 block uppercase">
          {date}
        </span>
        <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
        <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
          {desc}
        </p>
      </div>
    </div>
  );
}
