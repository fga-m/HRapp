"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Search, Users, Network } from "lucide-react";
import OrgChartView from "@/components/people/OrgChartView";

export type DirectoryPerson = {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  avatar_url: string | null;
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function PersonCard({ person, canManage }: { person: DirectoryPerson; canManage: boolean }) {
  const body = (
    <>
      {person.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.avatar_url}
          alt={person.full_name}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#223149] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">{initials(person.full_name)}</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#223149] truncate">{person.full_name}</p>
        {person.position && (
          <p className="text-xs text-[#50676E] truncate">{person.position}</p>
        )}
        <a
          href={`mailto:${person.email}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-[#50676E] hover:text-[#223149] hover:underline mt-1 truncate max-w-full"
        >
          <Mail className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{person.email}</span>
        </a>
      </div>
    </>
  );

  const cls =
    "bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow";

  // Only staff managers get a link through to the full profile.
  return canManage ? (
    <Link href={`/dashboard/staff/${person.id}`} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function PeopleTabs({ people, canManage }: { people: DirectoryPerson[]; canManage: boolean }) {
  const searchParams = useSearchParams();
  const [view, setView] = useState<"directory" | "chart">(
    searchParams.get("view") === "chart" ? "chart" : "directory"
  );
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? people.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.position ?? "").toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      )
    : people;

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("directory")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            view === "directory"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
          }`}
        >
          <Users className="w-4 h-4" />
          Directory
        </button>
        <button
          onClick={() => setView("chart")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            view === "chart"
              ? "bg-[#223149] text-white"
              : "border border-[#ECE3DF] text-[#50676E] hover:bg-[#F8F6F4]"
          }`}
        >
          <Network className="w-4 h-4" />
          Org Chart
        </button>
      </div>

      {view === "directory" ? (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-[#ECE3DF] max-w-sm">
            <Search className="w-4 h-4 text-[#50676E] flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, position or email…"
              className="flex-1 text-sm text-[#223149] placeholder:text-[#6E8189] focus:outline-none bg-transparent"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-[#50676E] py-8 text-center">No one matches that search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <PersonCard key={p.id} person={p} canManage={canManage} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <OrgChartView />
      )}
    </div>
  );
}

export default function PeopleClient(props: { people: DirectoryPerson[]; canManage: boolean }) {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <PeopleTabs {...props} />
    </Suspense>
  );
}
