"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, FileText, CheckSquare, Bell, Check, FileSignature, Palmtree, MessageSquare, TrendingUp } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import PageSubtitle from "@/components/PageSubtitle";
import PushSetup from "@/components/notifications/PushSetup";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import { useAppContext } from "@/context/AppContext";
import LeaveEmailTemplateEditor from "@/components/settings/LeaveEmailTemplateEditor";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "policy" | "meeting" | "checklist" | "general" | "contract" | "leave" | "note" | "performance";
  reference_id: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function typeIcon(type: Notification["type"]) {
  switch (type) {
    case "policy":      return <Shield className="w-4 h-4" />;
    case "meeting":     return <FileText className="w-4 h-4" />;
    case "checklist":   return <CheckSquare className="w-4 h-4" />;
    case "contract":    return <FileSignature className="w-4 h-4" />;
    case "leave":       return <Palmtree className="w-4 h-4" />;
    case "note":        return <MessageSquare className="w-4 h-4" />;
    case "performance": return <TrendingUp className="w-4 h-4" />;
    default:            return <Bell className="w-4 h-4" />;
  }
}

function typeColor(type: Notification["type"]) {
  switch (type) {
    case "policy":      return "bg-[#223149] text-white";
    case "meeting":     return "bg-[#5F7C84] text-white";
    case "checklist":   return "bg-emerald-500 text-white";
    case "contract":    return "bg-indigo-500 text-white";
    case "leave":       return "bg-teal-500 text-white";
    case "note":        return "bg-[#5F7C84] text-white";
    case "performance": return "bg-amber-500 text-white";
    default:            return "bg-[#9BADB7] text-white";
  }
}

function targetHref(n: Notification) {
  if (n.link) return n.link;
  if (!n.reference_id) return null;
  switch (n.type) {
    case "policy":    return `/dashboard/policies/${n.reference_id}`;
    case "meeting":   return `/dashboard/meetings/${n.reference_id}`;
    case "checklist": return `/dashboard/onboarding/${n.reference_id}`;
    default:          return null;
  }
}

function viewLabel(type: Notification["type"]) {
  switch (type) {
    case "policy":      return "View policy";
    case "meeting":     return "View meeting";
    case "checklist":   return "View checklist";
    case "contract":    return "View contract";
    case "leave":       return "View leave request";
    case "note":        return "View note";
    case "performance": return "View review";
    default:            return "View";
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
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const { isAdmin, can } = useAppContext();
  // Who can manage email templates: admins, or anyone who can approve leave
  // (the email templates are the leave approve/decline messages).
  const canManageEmail = isAdmin || can("approve_leave");
  const [tab, setTab] = useState<"alerts" | "preferences" | "templates">("alerts");

  const fetchNotifications = () => {
    setError(null);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => { setNotifications(d.notifications ?? []); setLoading(false); })
      .catch(() => { setError("Couldn't load notifications — please try again."); setLoading(false); });
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    setMarkingAll(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark all read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      setError("Couldn't mark notifications as read — please try again.");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) {
      try {
        const res = await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
        if (!res.ok) throw new Error("Failed to mark read");
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
        );
      } catch {
        setError("Couldn't update that notification — please try again.");
      }
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
          <PageSubtitle pageKey="notifications" defaultDescription="Your recent alerts and updates from across the portal." />
          {unreadCount > 0 && (
            <p className="text-sm text-[#50676E] mt-1">{unreadCount} unread</p>
          )}
        </div>
        {tab === "alerts" && unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#ECE3DF] text-sm font-semibold text-[#50676E] hover:bg-[#F8F6F4] transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      {/* Tabs — actual alerts first; notification settings live under Preferences.
          Email templates only for admins / leave approvers. */}
      <div className="flex border-b border-[#ECE3DF] gap-6">
        {([
          ["alerts", "My alerts"],
          ["preferences", "Preferences"],
          ...(canManageEmail ? [["templates", "Email templates"]] : []),
        ] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as "alerts" | "preferences" | "templates")}
            className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? "border-[#223149] text-[#223149]" : "border-transparent text-[#50676E] hover:text-[#223149]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "templates" && canManageEmail ? (
        <div className="space-y-6">
          <p className="text-sm text-[#50676E]">
            These emails are sent automatically around leave requests. Edit the wording, sender name and
            reply-to address below. They send from the connected Gmail account (set up under Settings).
          </p>
          <LeaveEmailTemplateEditor
            kind="request"
            title="New leave request email (to approvers)"
            description="Sent to everyone who can approve leave when a new request is submitted."
          />
          <LeaveEmailTemplateEditor
            kind="approve"
            title="Leave approval email"
            description="Sent to a staff member when their leave is approved."
          />
          <LeaveEmailTemplateEditor
            kind="decline"
            title="Leave decline email"
            description="Sent to a staff member when their leave is declined (includes the reason)."
          />
        </div>
      ) : tab === "preferences" ? (
        <div className="space-y-6">
          {/* Per-device push opt-in */}
          <PushSetup />
          {/* Per-user topic preferences ("choose what you're notified about") */}
          <NotificationPreferences />
        </div>
      ) : (
      <>
      {/* Loading */}
      {loading && !error && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-[#223149] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-6 h-6 text-red-400" />
          </div>
          <p className="font-semibold text-[#223149]">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchNotifications(); }}
            className="mt-4 px-4 py-2 rounded-xl border border-[#ECE3DF] text-sm font-semibold text-[#50676E] hover:bg-[#F8F6F4] transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notifications.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-[#ECE3DF] flex items-center justify-center mx-auto mb-4">
            <Bell className="w-6 h-6 text-[#50676E]" />
          </div>
          <p className="font-semibold text-[#223149]">You're all caught up</p>
          <p className="text-sm text-[#50676E] mt-1">No notifications yet</p>
        </div>
      )}

      {/* Notification groups */}
      {!loading && !error && groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-semibold text-[#50676E] uppercase tracking-wide mb-2 px-1">
            {group.label}
          </p>
          <div className="bg-white rounded-2xl border border-[#ECE3DF] shadow-sm overflow-hidden divide-y divide-[#ECE3DF]">
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
                    <p className={`text-sm leading-snug ${n.is_read ? "text-[#50676E]" : "font-semibold text-[#223149]"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-[#50676E] mt-0.5 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs text-[#50676E]">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                      {href && (
                        <span className="text-xs font-medium text-[#223149]">
                          → {viewLabel(n.type)}
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
      </>
      )}
    </div>
  );
}
