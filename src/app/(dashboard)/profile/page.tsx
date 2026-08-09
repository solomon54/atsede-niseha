//src/app/(dashboard)/profile/page.tsx
import {
  Award,
  BookOpen,
  Calendar,
  Church,
  Fingerprint,
  LogOut,
  Mail,
  MapPin,
  Phone,
  School,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getSession } from "@/core/auth/session.service";
import { adminDb } from "@/services/firebase/admin";
import { SanctuaryBackground } from "@/shared/components/ui/sanctuary-background";
import { SanctuarySurface } from "@/shared/components/ui/sanctuary-surface";

/* ─────────────────────────────────────────────
   UNIFIED PROFILE TYPE
───────────────────────────────────────────── */
interface UnifiedProfile {
  eotcUid: string;
  fullName: string;
  christianName: string;
  secularName?: string;
  title?: string;               // Father: ቀሲስ / መልአከ etc.
  photoUrl?: string;
  email: string;
  phone?: string;
  diocese: string;
  parish?: string;              // Father only
  university?: string;          // Student only
  department?: string;          // Student only
  academicYear?: number;        // Student only
  region?: string;
  city?: string;
  status: string;
  joinedAt: string;
  lastNisehaDate?: string;      // Student timeline
  lastQurbanDate?: string;      // Student timeline
}

/* ─────────────────────────────────────────────
   DATA FETCHING PER ROLE
───────────────────────────────────────────── */
async function fetchProfile(uid: string, role: string): Promise<UnifiedProfile | null> {
  try {
    if (role === "STUDENT") {
      const snap = await adminDb
        .collection("Students")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0].data();
      return {
        eotcUid:        d.eotcUid || snap.docs[0].id,
        fullName:       d.fullName || d.secularName || "ያልታወቀ ስም",
        christianName:  d.christianName || "—",
        secularName:    d.secularName || "",
        photoUrl:       d.photoUrl,
        email:          d.email || "",
        phone:          d.phone || "",
        diocese:        d.diocese || "ያልተጠቀሰ",
        university:     d.university || "",
        department:     d.department || "",
        academicYear:   Number(d.academicYear) || undefined,
        region:         d.region || "",
        city:           d.city || "",
        status:         d.status || "ACTIVE",
        joinedAt:       d.createdAt
          ? new Date(
              typeof d.createdAt === "string"
                ? d.createdAt
                : d.createdAt._seconds * 1000
            ).toLocaleDateString("am-ET", { dateStyle: "medium" })
          : "—",
        lastNisehaDate: d.lastNisehaDate || null,
        lastQurbanDate: d.lastQurbanDate || null,
      };
    }

    if (role === "FATHER") {
      const snap = await adminDb
        .collection("Fathers")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0].data();
      return {
        eotcUid:       d.eotcUid || snap.docs[0].id,
        fullName:      d.fullName || "ያልታወቀ ስም",
        christianName: d.christianName || d.fullName || "—",
        title:         d.title || "",
        photoUrl:      d.photoUrl,
        email:         d.email || "",
        phone:         d.phone || "",
        diocese:       d.diocese || "ያልተጠቀሰ",
        parish:        d.parish || "",
        status:        d.status || "ACTIVE",
        joinedAt:      d.accessGrantedAt?.toDate?.()
          ? d.accessGrantedAt.toDate().toLocaleDateString("am-ET", { dateStyle: "medium" })
          : "—",
      };
    }

    if (role === "GOVERNOR") {
      // Governors use their eotcUid as doc ID
      const eotcSnap = await adminDb.collection("Governors").get();
      const govDoc = eotcSnap.docs.find((d) => d.data().uid === uid);
      if (!govDoc) return null;
      const d = govDoc.data();
      return {
        eotcUid:       govDoc.id,
        fullName:      d.fullName || d.secularName || "ያልታወቀ ስም",
        christianName: d.christianName || "—",
        title:         d.title || "ዋና ሃላፊ",
        photoUrl:      d.photoUrl,
        email:         d.email || "",
        diocese:       d.diocese || "ማዕከላዊ",
        status:        d.status || "ACTIVE",
        joinedAt:      d.createdAt
          ? new Date(d.createdAt).toLocaleDateString("am-ET", { dateStyle: "medium" })
          : "—",
      };
    }

    return null;
  } catch (err) {
    console.error("[ProfilePage] fetch error:", err);
    return null;
  }
}

/* ─────────────────────────────────────────────
   ROLE DISPLAY HELPERS
───────────────────────────────────────────── */
const ROLE_LABEL: Record<string, string> = {
  STUDENT:  "የንስሐ ልጅ",
  FATHER:   "መምህረ ንስሐ",
  GOVERNOR: "ሃላፊ / ፈቃጅ",
};
const ROLE_COLOR: Record<string, string> = {
  STUDENT:  "bg-blue-900 text-blue-100",
  FATHER:   "bg-amber-900 text-amber-100",
  GOVERNOR: "bg-slate-900 text-slate-100",
};

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/");

  const role = (session.role as string) || "STUDENT";
  const profile = await fetchProfile(session.uid, role);

  if (!profile) redirect("/unauthorized?reason=profile_not_found");

  return (
    <main className="relative min-h-screen bg-[#fdfcf6] pb-24 overflow-x-hidden">
      <SanctuaryBackground />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 space-y-6">

        {/* ── IDENTITY HEADER ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white
              shadow-xl overflow-hidden bg-amber-50">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="Portrait"
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-amber-100">
                  <UserIcon className="w-10 h-10 text-amber-300" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-[3px]
              border-[#fdfcf6] p-1.5 rounded-full shadow-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Name block */}
          <div className="text-center sm:text-left flex-1 min-w-0 space-y-1.5">
            {profile.title && (
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600">
                {profile.title}
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-serif text-slate-900 leading-tight truncate">
              {profile.fullName}
            </h1>
            <p className="text-base sm:text-lg text-amber-700 font-serif">
              {profile.christianName}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-1">
              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase
                tracking-widest ${ROLE_COLOR[role] || "bg-slate-800 text-white"}`}>
                {ROLE_LABEL[role] || role}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase
                tracking-widest border ${
                  profile.status === "ACTIVE"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-200 text-red-600"
                }`}>
                {profile.status === "ACTIVE" ? "ንቁ" : profile.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── MAIN REGISTRY ── */}
          <div className="lg:col-span-2 space-y-5">
            <SanctuarySurface className="p-5 sm:p-7">
              <div className="flex items-center gap-2 border-b border-amber-100 pb-4 mb-6">
                <Award className="w-4 h-4 text-amber-600" />
                <h2 className="text-xs font-black text-amber-900 uppercase tracking-widest">
                  መዝገብ
                </h2>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Official Registry
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                <ProfileItem icon={<Mail className="w-4 h-4" />}
                  label="ኢሜይል" sub="EMAIL" value={profile.email || "—"} />

                <ProfileItem icon={<MapPin className="w-4 h-4" />}
                  label="ሀገረ ስብከት" sub="DIOCESE" value={profile.diocese} />

                {profile.phone && (
                  <ProfileItem icon={<Phone className="w-4 h-4" />}
                    label="ስልክ" sub="PHONE" value={profile.phone} />
                )}

                {profile.parish && (
                  <ProfileItem icon={<Church className="w-4 h-4" />}
                    label="ጽዮን / ቤተክርስቲያን" sub="PARISH" value={profile.parish} />
                )}

                {role === "STUDENT" && profile.university && (
                  <ProfileItem icon={<School className="w-4 h-4" />}
                    label="ዩኒቨርሲቲ" sub="UNIVERSITY" value={profile.university} />
                )}

                {role === "STUDENT" && profile.department && (
                  <ProfileItem icon={<BookOpen className="w-4 h-4" />}
                    label="ትምህርት ክፍል" sub="DEPARTMENT"
                    value={`${profile.department}${profile.academicYear ? ` — ዓ ${profile.academicYear}` : ""}`} />
                )}

                <ProfileItem icon={<Calendar className="w-4 h-4" />}
                  label="የተመዘገቡበት ቀን" sub="JOINED" value={profile.joinedAt} />
              </div>
            </SanctuarySurface>

            {/* Spiritual timeline — Student only */}
            {role === "STUDENT" && (profile.lastNisehaDate || profile.lastQurbanDate) && (
              <SanctuarySurface className="p-5 sm:p-7">
                <div className="flex items-center gap-2 border-b border-amber-100 pb-4 mb-5">
                  <Church className="w-4 h-4 text-amber-600" />
                  <h2 className="text-xs font-black text-amber-900 uppercase tracking-widest">
                    መንፈሳዊ ጊዜ ሰሌዳ
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                  {profile.lastNisehaDate && (
                    <ProfileItem icon={<ShieldCheck className="w-4 h-4" />}
                      label="የመጨረሻ ንስሐ" sub="LAST CONFESSION"
                      value={profile.lastNisehaDate} />
                  )}
                  {profile.lastQurbanDate && (
                    <ProfileItem icon={<ShieldCheck className="w-4 h-4" />}
                      label="የመጨረሻ ቁርባን" sub="LAST COMMUNION"
                      value={profile.lastQurbanDate} />
                  )}
                </div>
              </SanctuarySurface>
            )}
          </div>

          {/* ── SOVEREIGNTY SIDEBAR ── */}
          <div className="space-y-4">
            <SanctuarySurface className="p-5 bg-[#111] text-stone-200 border-none">
              <div className="flex items-center gap-3 border-b border-stone-800 pb-4 mb-5">
                <Fingerprint className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">ዲጂታል መታወቂያ</p>
                  <p className="text-[8px] text-stone-500 uppercase tracking-wider">
                    Digital Sovereignty
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[9px] text-amber-500/80 font-black uppercase
                    tracking-widest mb-1.5">
                    EOTC GLOBAL UID
                  </p>
                  <p className="text-[11px] font-mono text-stone-300 break-all
                    bg-stone-800/60 px-3 py-2.5 rounded-lg border border-stone-700/60">
                    {profile.eotcUid}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-800">
                  <p className="text-[10px] leading-relaxed text-stone-500 italic">
                    &quot;ይህ መገለጫ የእርስዎ መንፈሳዊ ማንነት ነው። ለማስተካከል ለንስሐ አባትዎ ያሳውቁ።&quot;
                  </p>
                </div>
              </div>
            </SanctuarySurface>

            {/* Logout */}
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────
   LOGOUT BUTTON (client component)
───────────────────────────────────────────── */
function LogoutButton() {
  // Server component renders a form so it works without JS
  return (
    <form action="/api/auth/logout" method="POST">
      <button type="submit"
        className="w-full flex items-center justify-center gap-2 px-4 py-3
          rounded-2xl border border-red-200 bg-white text-red-600 text-xs
          font-black uppercase tracking-widest hover:bg-red-50 transition-colors">
        <LogOut className="w-4 h-4" />
        ወጣ / Logout
      </button>
    </form>
  );
}

/* ─────────────────────────────────────────────
   PROFILE ITEM
───────────────────────────────────────────── */
interface ProfileItemProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: string;
}

function ProfileItem({ icon, label, sub, value }: ProfileItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-amber-50 rounded-lg text-amber-600 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-800">{label}</p>
        <p className="text-[7px] font-black text-amber-600/40 uppercase tracking-widest -mt-0.5">
          {sub}
        </p>
        <p className="text-sm text-slate-600 mt-0.5 font-medium break-words">
          {value}
        </p>
      </div>
    </div>
  );
}
