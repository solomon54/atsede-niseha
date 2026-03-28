//src/app/(dashboard)/profile/page.tsx

import {
  Award,
  BookOpen,
  Calendar,
  Fingerprint,
  Mail,
  MapPin,
  School,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import { StudentProfileService } from "@/features/student/services/studentProfile.service";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";
import { UserSession } from "@/shared/types/shared.types.auth";

// Define a unified Profile type to eliminate 'any'
interface UnifiedProfile {
  fullName: string;
  christianName: string;
  title?: string;
  photoUrl?: string;
  university?: string;
  department?: string;
  diocese: string;
  parish?: string;
  status: string;
  joinedAt: string;
  email: string;
  eotcUid: string;
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/");

  // REAL DATA FETCHING logic based on role
  let profile: UnifiedProfile;

  try {
    if (session.role === "CHILED") {
      const data = await StudentProfileService.getProfile(session.uid);
      profile = {
        ...data,
        eotcUid: session.uid,
      };
    } else {
      // Fallback for FATHER/GOVERNOR until their specific services are linked
      profile = {
        fullName: session.email?.split("@")[0] || "User",
        christianName: "የእግዚአብሔር አገልጋይ",
        diocese: "አዲስ አበባ (Addis Ababa)",
        status: "ACTIVE",
        joinedAt: "2017 ዓ.ም",
        email: session.email || "",
        eotcUid: session.uid,
      };
    }
  } catch (e) {
    redirect("/unauthorized");
  }

  return (
    <main className="relative min-h-screen bg-[#fdfcf6] pb-20 overflow-x-hidden">
      <SanctuaryBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16">
        {/* --- IDENTITY HEADER (Amharic Dominant) --- */}
        <div className="flex flex-col items-center md:items-start md:flex-row gap-6 mb-10">
          <div className="relative shrink-0">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-amber-50">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt="Portrait"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-amber-100">
                  <UserIcon className="w-12 h-12 text-amber-300" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 border-[3px] border-[#fdfcf6] p-1.5 rounded-full shadow-lg">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="text-center md:text-left space-y-1">
            <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 leading-tight">
              {profile.fullName}
            </h1>
            <p className="text-xl sm:text-2xl text-amber-700 font-serif">
              {profile.christianName}
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
              <span className="px-3 py-1 rounded-md bg-amber-900 text-amber-50 text-[9px] font-bold uppercase tracking-tighter">
                role • {session.role}
              </span>
              <span className="px-3 py-1 rounded-md bg-white border border-amber-200 text-green-700 text-[9px] font-bold uppercase tracking-tighter">
                status • {profile.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* --- THE SACRED RECORD (Main Content) --- */}
          <div className="lg:col-span-2 space-y-6">
            <SanctuarySurface className="p-5 sm:p-8">
              <div className="flex items-center justify-between border-b border-amber-100 pb-4 mb-6">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  መዝገብ{" "}
                  <span className="text-[10px] text-amber-500 font-normal opacity-60">
                    OFFICIAL REGISTRY
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <ProfileItem
                  icon={<Mail className="w-4 h-4" />}
                  label="ኢሜይል"
                  subLabel="EMAIL ADDRESS"
                  value={profile.email}
                />
                <ProfileItem
                  icon={<MapPin className="w-4 h-4" />}
                  label="ሀገረ ስብከት"
                  subLabel="DIOCESE"
                  value={profile.diocese}
                />
                {session.role === "STUDENT" && (
                  <>
                    <ProfileItem
                      icon={<School className="w-4 h-4" />}
                      label="ተቋም"
                      subLabel="INSTITUTION"
                      value={profile.university || "ያልተጠቀሰ"}
                    />
                    <ProfileItem
                      icon={<BookOpen className="w-4 h-4" />}
                      label="ትምህርት ክፍል"
                      subLabel="DEPARTMENT"
                      value={profile.department || "ጠቅላላ"}
                    />
                  </>
                )}
                <ProfileItem
                  icon={<Calendar className="w-4 h-4" />}
                  label="የተመዘገቡበት ቀን"
                  subLabel="REGISTRY DATE"
                  value={profile.joinedAt}
                />
              </div>
            </SanctuarySurface>
          </div>

          {/* --- SOVEREIGNTY SIDEBAR --- */}
          <div className="space-y-6">
            <SanctuarySurface className="p-6 bg-[#1a1a1a] text-stone-200 border-none">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-stone-800 pb-4">
                  <Fingerprint className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide">
                      ዲጂታል መታወቂያ
                    </h3>
                    <p className="text-[8px] text-stone-500 uppercase">
                      Digital Sovereignty
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] text-amber-500/80 font-bold">
                      EOTC GLOBAL UID
                    </p>
                    <p className="text-xs font-mono text-stone-300 mt-1.5 break-all bg-stone-800/50 p-2 rounded border border-stone-700">
                      {profile.eotcUid}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-stone-800">
                    <p className="text-[11px] leading-relaxed text-stone-400 italic">
                      &quot;ይህ መገለጫ የእርስዎ መንፈሳዊ ማንነት መለያ ነው። መረጃ ለማስተካከል እባክዎ
                      ለንስሐ አባትዎ ጥያቄ ያቅርቡ።&quot;
                    </p>
                    <p className="text-[8px] mt-2 text-stone-600 uppercase font-bold tracking-widest">
                      Changes require spiritual authorization
                    </p>
                  </div>
                </div>
              </div>
            </SanctuarySurface>
          </div>
        </div>
      </div>
    </main>
  );
}

// Strictly typed helper component
interface ProfileItemProps {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  value: string;
}

function ProfileItem({ icon, label, subLabel, value }: ProfileItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-amber-50 rounded-lg text-amber-600 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-900">{label}</span>
          <span className="text-[8px] text-amber-600/50 font-black tracking-widest uppercase -mt-0.5">
            {subLabel}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1 font-medium truncate">
          {value}
        </p>
      </div>
    </div>
  );
}
