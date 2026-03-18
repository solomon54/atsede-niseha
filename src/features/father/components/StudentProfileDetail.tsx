// src/features/father/components/StudentProfileDetail.tsx

"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Calendar,
  CalendarDays,
  Cross,
  Fingerprint,
  Flame,
  Globe,
  GraduationCap,
  Hash,
  History,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";

import { StudentRecord } from "@/shared/types";
import { cn } from "@/shared/utils/utils";

export default function StudentProfileDetail({
  student,
}: {
  student: StudentRecord;
}) {
  const isPillar =
    student.role === "BIG_BROTHER" || student.role === "BIG_SISTER";

  // Mock data for the Timeline - replace with real fetch later
  const milestones = [
    {
      type: "EUCHARIST",
      date: "12/6/2016",
      label: "ቅዱስ ቁርባን (Holy Communion)",
      location: "Holy Trinity Cathedral",
    },
    {
      type: "PENANCE",
      date: "01/4/2016",
      label: "ንስሐ (Penance)",
      location: "Personal Confession",
    },
    {
      type: "ONBOARDING",
      date: "18/3/2016",
      label: "ወደ ዓጸደ ንስሐ ተቀላቀለ (Joined Sanctuary)",
      location: "System",
    },
  ];

  return (
    <div className="space-y-12 pb-20 font-sans">
      {/* SECTION 1: THE SACRED HALO */}
      <section className="relative flex flex-col items-center text-center py-10">
        <div className="relative mb-6">
          <div className="absolute inset-0 border border-amber-200/40 rounded-full border-dashed animate-spin-[30s_linear_infinite]" />
          <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-3xl" />
          <div className="relative p-1.5 bg-gradient-to-b from-amber-400 to-amber-100 rounded-full shadow-2xl">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white bg-slate-100">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-8 text-slate-300" />
              )}
            </div>
          </div>
          <div
            className={cn(
              "absolute -bottom-2 right-0 px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg border",
              student.accountClaimed
                ? "bg-emerald-500 text-white border-emerald-400"
                : "bg-amber-500 text-white border-amber-400"
            )}>
            {student.accountClaimed ? "Active Sanctuary" : "Pending Claim"}
          </div>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
          {student.fullName}
        </h1>
        <p className="text-lg font-black text-amber-600 font-ethiopic tracking-wide">
          {student.christianName} <span className="text-slate-300 mx-2">|</span>{" "}
          {student.spiritualTitle}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: ACADEMIC & PILLAR */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <header className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-slate-950 text-white rounded-2xl">
                <GraduationCap size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.3em]">
                  Academic Journey
                </p>
                <h3 className="text-xl font-black text-slate-900 font-ethiopic">
                  የትምህርት መረጃ
                </h3>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
              <InfoBlock
                icon={Landmark}
                label="University"
                value={student.university}
              />
              <InfoBlock
                icon={BookOpen}
                label="College"
                value={student.college}
                isEthiopic
              />
              <InfoBlock
                icon={Zap}
                label="Department"
                value={student.department}
                isEthiopic
              />
              <div className="grid grid-cols-2 gap-4">
                <InfoBlock
                  icon={Calendar}
                  label="Year"
                  value={`${student.academicYear}ኛ ዓመት`}
                />
                <InfoBlock
                  icon={Hash}
                  label="Semester"
                  value={`${student.semester}ኛ ሴሚስተር`}
                />
              </div>
            </div>
          </div>

          {/* SPIRITUAL TIMELINE (The "Incense Trail") */}
          <div className="space-y-6 px-2">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.4em]">
                  Life Archives
                </p>
                <h3 className="text-2xl font-black text-slate-900 font-ethiopic">
                  የመንፈስ ጉዞ
                </h3>
              </div>
              <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                <History size={20} />
              </div>
            </header>
            <div className="relative pl-8 space-y-8">
              <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-amber-500 via-amber-200 to-transparent" />
              {milestones.map((event, idx) => (
                <TimelineEvent key={idx} event={event} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: IDENTITY & COMMAND */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-[#fdfcf6] border border-amber-100 rounded-[2.5rem] p-8 shadow-inner">
            <header className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-amber-500 text-white rounded-2xl">
                <Fingerprint size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.3em]">
                  Origin & Link
                </p>
                <h3 className="text-xl font-black text-slate-900 font-ethiopic">
                  ማንነት እና መገኛ
                </h3>
              </div>
            </header>
            <div className="space-y-6">
              <ContactBlock icon={Phone} label="Phone" value={student.phone} />
              <ContactBlock
                icon={Mail}
                label="Digital Mail"
                value={student.email}
              />
              <ContactBlock
                icon={MapPin}
                label="Diocese"
                value={student.diocese}
                isEthiopic
              />
              <div className="pt-4 border-t border-amber-200/40">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Born on (Ethiopic)
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {student?.birthDate.day}/{student.birthDate.month}/
                  {student.birthDate.year}{" "}
                  <span className="font-ethiopic text-sm">ዓ.ም</span>
                </p>
              </div>
            </div>
          </div>

          {/* PERMANENT ID */}
          <div className="bg-slate-950 rounded-[2rem] p-6 text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <ShieldCheck size={120} />
            </div>
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.4em] mb-4">
              Ecclesiastical UID
            </p>
            <p className="text-xl font-mono tracking-tighter text-amber-100 relative z-10">
              {student.eotcUid}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: RULE MONITORING */}
      <section className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <header className="relative z-10 mb-10 text-center">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.5em] mb-2">
            Active Spiritual Orders
          </p>
          <h3 className="text-3xl font-black font-ethiopic">
            የቀኖና ክትትል (Rule Monitoring)
          </h3>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          <OrderCard
            title="ጾም (Fasting)"
            status="ACTIVE"
            progress={80}
            icon={ShieldCheck}
            color="amber"
          />
          <OrderCard
            title="ጸሎት (Prayer)"
            status="STREAK"
            progress={100}
            icon={Flame}
            color="emerald"
          />
          <OrderCard
            title="ምጽዋት (Alms)"
            status="PENDING"
            progress={30}
            icon={Cross}
            color="slate"
          />
        </div>
      </section>
    </div>
  );
}

/* SUB-COMPONENTS */

function TimelineEvent({ event }: { event: any }) {
  return (
    <div className="relative group">
      <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full border-4 border-[#fdfcf6] bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10" />
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm group-hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "p-3 rounded-xl",
                event.type === "EUCHARIST"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-slate-50 text-slate-600"
              )}>
              {event.type === "EUCHARIST" ? (
                <Flame size={20} />
              ) : (
                <Cross size={20} />
              )}
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 font-ethiopic">
                {event.label}
              </h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                {event.location}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
              {event.date} ዓ.ም
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ title, status, progress, icon: Icon, color }: any) {
  const colorMap: any = {
    amber: "text-amber-400 bg-amber-500/20 bar-bg-amber-500",
    emerald: "text-emerald-400 bg-emerald-500/20 bar-bg-emerald-500",
    slate: "text-slate-400 bg-slate-500/20 bar-bg-slate-500",
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-colors group">
      <div className="flex items-center justify-between mb-6">
        <div
          className={cn(
            "p-3 rounded-xl",
            colorMap[color].split(" ").slice(0, 2).join(" ")
          )}>
          <Icon size={20} />
        </div>
        <span className="text-[8px] font-black px-2 py-1 bg-white/10 rounded-md tracking-widest uppercase">
          {status}
        </span>
      </div>
      <h4 className="text-xl font-bold font-ethiopic mb-4 flex items-center justify-between">
        {title}{" "}
        <ArrowUpRight
          size={14}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </h4>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-1000",
            color === "amber"
              ? "bg-amber-500"
              : color === "emerald"
              ? "bg-emerald-500"
              : "bg-slate-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value, isEthiopic = false }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-bold text-slate-800",
          isEthiopic && "font-ethiopic text-[15px]"
        )}>
        {value}
      </p>
    </div>
  );
}

function ContactBlock({ icon: Icon, label, value, isEthiopic = false }: any) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="w-10 h-10 rounded-xl bg-white border border-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
          {label}
        </p>
        <p
          className={cn(
            "text-xs font-bold text-slate-800",
            isEthiopic && "font-ethiopic text-sm"
          )}>
          {value}
        </p>
      </div>
    </div>
  );
}
