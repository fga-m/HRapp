"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, FileText, CheckSquare, Bell, Check } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "policy" | "meeting" | "checklist" | "general";
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
};

function typeIcon(type: Notification["type"]) {
  switch (type) {
    case "policy":    return <Shield className="w-4 h-4" />;
    case "meeting":   return <FileText className="w-4 h-4" />;
    case "checklist": return <CheckSquare className="w-4 h-4" />;
    default:          return <Bell className="w-4 h-4" />;
  }
}

function typeColor(type: Notification["type"]) {
  switch (type) {
    case "policy":    return "bg-[#223149] text-white";
    case "meeting":   return "bg-[#5F7C84] text-white";
    case "checklist": return "bg-emerald-500 text-white";
    default:          return "bg-[#9BADB7] text-white";
  }
}

function targetHref(n: Notification) {
  if (!n.reference_id) return null;
  switch (n.type) {
    case "policy":    return `/dashboard/policies/${n.reference_id}`;
    case "meeting":   return `/dashboard/meetings/${n.reference_id}`;
    case "checklist": return `/dashboard/onboarding/${n.reference_id}`;
    default:          return null;
  }
}

function groupLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMMM yyyy");
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => { setNotifications(d.notifications ?? []); setLoading(false); });
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    setMarkingAll(true);
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
    }
    const href = targetHref(n);
    if (href) router.push(href);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Group notifications by date label
  const groups: { label: string; items: Notification[] }[] = [];
  for (const n of notifications) {
    const label = groupLabel(n.created_at);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#223149]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[#5F7C84] mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ECE3DF] text-sm font-semibold text-[#5F7C84] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#ECE3DF] flex items-center justify-center mx-auto mb-4">
            <Bell className="w-6 h-6 text-[#9BADB7]" />
          </div>
          <p className="font-semibold text-[#223149]">You're all caught up</p>
          <p className="text-sm text-[#9BADB7] mt-1">No notifications yet</p>
        </div>
      )}

      {/* Notification groups */}
      {!loading && groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-semibold text-[#9BADB7] uppercase tracking-wide mb-2 px-1">
            {group.label}
          </p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-[#ECE3DF]">
            {group.items.map((n) => {
              const href = targetHref(n);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-4 px-5 py-4 text-left transition-colors ${
                    n.is_read ? "hover:bg-[#F8F6F4]" : "bg-[#223149]/[0.03] hover:bg-[#223149]/[0.06]"
                  }`}
                >
                  {/* Type icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${typeColor(n.type)}`}>
                    {typeIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.is_read ? "text-[#5F7C84]" : "font-semibold text-[#223149]"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-[#9BADB7] mt-0.5 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-[#9BADB7]">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                      {href && (
                        <span className="text-xs font-medium text-[#223149]">
                          → {n.type === "policy" ? "View policy" : n.type === "meeting" ? "View meeting" : "View"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[#223149] flex-shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
