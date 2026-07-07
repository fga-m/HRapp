import Link from "next/link";
import { ChevronRight, Shield, FileSignature, CheckSquare, ListTodo } from "lucide-react";

export type ActionItem = {
  kind: "policy" | "contract" | "checklist";
  label: string;
  sublabel?: string;
  href: string;
};

const ICONS = {
  policy: Shield,
  contract: FileSignature,
  checklist: CheckSquare,
} as const;

/**
 * The caller's personal obligations — policies awaiting their signature,
 * contracts awaiting their signature, and checklists with open required
 * tasks — in one list, so nobody has to trawl three pages to find out
 * what's waiting on them. Renders nothing when there's nothing to do.
 */
export default function ActionItemsCard({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;

  const shown = items.slice(0, 6);
  const extra = items.length - shown.length;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-amber-50 border-b border-amber-200">
        <ListTodo className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          {items.length === 1 ? "1 thing needs" : `${items.length} things need`} your attention
        </p>
      </div>
      <div className="divide-y divide-[#F8F6F4]">
        {shown.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <Link
              key={`${item.kind}-${item.href}-${item.label}`}
              href={item.href}
              className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8F6F4] transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#ECE3DF] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[#223149]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#223149] truncate group-hover:underline">
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className="text-xs text-[#50676E] truncate">{item.sublabel}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-[#9BADB7] group-hover:text-[#223149] transition-colors flex-shrink-0" />
            </Link>
          );
        })}
      </div>
      {extra > 0 && (
        <p className="px-5 py-2.5 text-xs text-[#50676E] border-t border-[#F8F6F4]">
          + {extra} more
        </p>
      )}
    </div>
  );
}
