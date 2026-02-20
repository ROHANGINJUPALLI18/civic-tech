"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PlusCircle,
  ScanLine,
  ShieldCheck,
  Trophy,
  UserCheck,
} from "lucide-react";

import { SpotlightBanner } from "@/components/civic/spotlight-banner";
import { ReactBitsChip } from "@/components/civic/reactbits-chip";
import { Button } from "@/components/ui/button";
import { COMPLAINT_STATES, computeSlaRisk } from "@/lib/workflow";

const CATEGORY_OPTIONS = [
  "Pothole",
  "Garbage",
  "Streetlight",
  "Sewage Overflow",
];

const STATE_BADGE = {
  Reported: "bg-slate-100 text-slate-700",
  "AI Pre-Validation": "bg-indigo-100 text-indigo-700",
  "Community Review": "bg-amber-100 text-amber-700",
  Verified: "bg-blue-100 text-blue-700",
  Assigned: "bg-cyan-100 text-cyan-700",
  "In Progress": "bg-lime-100 text-lime-700",
  "Work Uploaded": "bg-sky-100 text-sky-700",
  "AI Resolution Validation": "bg-violet-100 text-violet-700",
  "Manager Review": "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  "User Confirmation": "bg-fuchsia-100 text-fuchsia-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

function badgeClass(state) {
  return STATE_BADGE[state] || "bg-slate-100 text-slate-700";
}

function getProgressPercent(state) {
  const position = COMPLAINT_STATES.findIndex((step) => step === state);
  return Math.max(
    0,
    Math.round(((position + 1) / COMPLAINT_STATES.length) * 100),
  );
}

function Notice({ type = "info", children }) {
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : type === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

function Pill({ children, tone = "blue" }) {
  const styles =
    tone === "purple"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function UserDashboardPage() {
  const [complaints, setComplaints] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [sessionUser, setSessionUser] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const [newComplaint, setNewComplaint] = useState({
    reporterName: "",
    title: "",
    description: "",
    category: "Pothole",
    ward: "Ward 12",
    scanConfirmed: false,
    complaintImageFile: null,
  });

  const [reviewRatings, setReviewRatings] = useState({});

  const setBusy = (id, value) => {
    setBusyIds((current) => {
      if (value && !current.includes(id)) return [...current, id];
      if (!value) return current.filter((item) => item !== id);
      return current;
    });
  };

  const applyStore = (store) => {
    setComplaints(store.complaints ?? []);
    setLogs(store.logs ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [bootstrapResponse, sessionResponse] = await Promise.all([
          fetch("/api/bootstrap", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

        if (!bootstrapResponse.ok) {
          throw new Error("Failed to load server state");
        }

        if (sessionResponse.ok) {
          const sessionPayload = await sessionResponse.json();
          setSessionUser(sessionPayload.user ?? null);
        }

        const store = await bootstrapResponse.json();
        applyStore(store);
      } catch {
        setFeedback({ type: "error", text: "Unable to load server state." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const closed = complaints.filter((item) => item.state === "Closed").length;
    const active = complaints.length - closed;
    const managerReview = complaints.filter(
      (item) => item.state === "Manager Review",
    ).length;
    const atRisk = complaints.filter(
      (item) => computeSlaRisk(item) !== "healthy",
    ).length;
    return { closed, active, managerReview, atRisk };
  }, [complaints]);

  const communityLeaderboard = useMemo(() => {
    const map = complaints.reduce((acc, item) => {
      const score = (acc[item.ward] ?? 0) + (item.communityWeight || 1);
      acc[item.ward] = score;
      return acc;
    }, {});

    return Object.entries(map)
      .map(([community, score]) => ({ community, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [complaints]);

  const callAndApply = async (url, options = {}, fallbackMessage) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(fallbackMessage || "Request failed");
    }
    const payload = await response.json();
    const nextStore = payload.store || payload;
    applyStore(nextStore);
    return payload;
  };

  const createComplaint = async () => {
    if (
      !newComplaint.reporterName.trim() ||
      !newComplaint.title.trim() ||
      !newComplaint.description.trim()
    ) {
      setFeedback({
        type: "warning",
        text: "Please fill reporter name, title, and description.",
      });
      return;
    }

    if (!newComplaint.complaintImageFile) {
      setFeedback({
        type: "warning",
        text: "Please upload a complaint image before submit.",
      });
      return;
    }

    setBusy("new", true);
    setFeedback({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("reporterName", newComplaint.reporterName);
      formData.append("title", newComplaint.title);
      formData.append("description", newComplaint.description);
      formData.append("category", newComplaint.category);
      formData.append("ward", newComplaint.ward);
      formData.append("scanConfirmed", String(newComplaint.scanConfirmed));
      formData.append("complaintImage", newComplaint.complaintImageFile);

      const payload = await callAndApply(
        "/api/complaints",
        { method: "POST", body: formData },
        "Create complaint failed",
      );

      setNewComplaint((current) => ({
        ...current,
        title: "",
        description: "",
        complaintImageFile: null,
      }));

      if (payload.duplicateAttached) {
        setFeedback({
          type: "info",
          text: "Duplicate complaint merged into existing issue.",
        });
      } else if (payload.warning) {
        setFeedback({
          type: "warning",
          text: "Complaint submitted with validation warning.",
        });
      } else {
        setFeedback({
          type: "success",
          text: "Complaint submitted and validated.",
        });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Failed to submit complaint.",
      });
    } finally {
      setBusy("new", false);
    }
  };

  const reviewComplaint = async (complaintId, accepted) => {
    const rating = reviewRatings[complaintId] || (accepted ? 5 : 1);
    setBusy(`rev-${complaintId}`, true);

    try {
      await callAndApply(
        `/api/complaints/${complaintId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted, rating }),
        },
        "Review update failed",
      );

      setFeedback({
        type: "success",
        text: accepted
          ? "Review submitted. Complaint closed with trust update."
          : "Dispute raised. Complaint returned to manager review.",
      });
    } catch {
      setFeedback({ type: "error", text: "Unable to submit review." });
    } finally {
      setBusy(`rev-${complaintId}`, false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <SpotlightBanner
            title="Citizen Dashboard"
            subtitle="Submit complaints, track progress, and review completed work."
          />
          <div className="flex flex-col items-end gap-2">
            <Pill>{sessionUser?.displayName || "Citizen User"}</Pill>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ReactBitsChip />
          <Pill>User workflow</Pill>
          <Pill tone="purple">Scan + AI validation</Pill>
        </div>

        {feedback.text ? (
          <Notice type={feedback.type}>{feedback.text}</Notice>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Active Complaints"
            value={stats.active}
            icon={<ShieldCheck size={16} className="text-slate-500" />}
          />
          <StatCard
            title="Closed"
            value={stats.closed}
            icon={<UserCheck size={16} className="text-slate-500" />}
          />
          <StatCard title="Manager Reviews" value={stats.managerReview} />
          <StatCard title="SLA At Risk" value={stats.atRisk} />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Scan & Submit Complaint
            </h3>
            <div className="space-y-2">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Your name"
                value={newComplaint.reporterName}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    reporterName: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Issue title"
                value={newComplaint.title}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Describe the problem"
                value={newComplaint.description}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={newComplaint.category}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ward"
                value={newComplaint.ward}
                onChange={(event) =>
                  setNewComplaint((current) => ({
                    ...current,
                    ward: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setNewComplaint((current) => ({
                    ...current,
                    complaintImageFile: selected,
                  }));
                }}
              />

              <Notice type={newComplaint.scanConfirmed ? "success" : "warning"}>
                {newComplaint.scanConfirmed
                  ? "Scan completed"
                  : "Scan complaint before submit"}
              </Notice>

              <Button
                variant="outline"
                onClick={() =>
                  setNewComplaint((current) => ({
                    ...current,
                    scanConfirmed: !current.scanConfirmed,
                  }))
                }
              >
                <ScanLine size={16} />
                {newComplaint.scanConfirmed ? "Re-scan" : "Scan Complaint"}
              </Button>

              <p className="text-xs text-slate-500">
                {newComplaint.complaintImageFile
                  ? `Image ready: ${newComplaint.complaintImageFile.name}`
                  : "No image selected"}
              </p>

              <Button
                onClick={createComplaint}
                disabled={busyIds.includes("new")}
                className="w-full"
              >
                <PlusCircle size={16} /> Submit Complaint
              </Button>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Complaints by User (Tracking)
            </h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading complaints...</p>
            ) : complaints.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Complaint</th>
                      <th className="px-2 py-2 font-medium">State</th>
                      <th className="px-2 py-2 font-medium">Progress</th>
                      <th className="px-2 py-2 font-medium">SLA</th>
                      <th className="px-2 py-2 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map((row) => {
                      const canReview = [
                        "Completed",
                        "User Confirmation",
                      ].includes(row.state);
                      const risk = computeSlaRisk(row);
                      return (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-2 py-2">
                            <p className="font-medium text-slate-900">
                              {row.id}
                            </p>
                            <p className="text-slate-600">{row.title}</p>
                            <p className="text-xs text-slate-500">
                              {row.category}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(row.state)}`}
                            >
                              {row.state}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="w-36 rounded-full bg-slate-100">
                              <div
                                className="rounded-full bg-slate-700 px-2 py-1 text-right text-[10px] font-medium text-white"
                                style={{
                                  width: `${getProgressPercent(row.state)}%`,
                                }}
                              >
                                {getProgressPercent(row.state)}%
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${risk === "breach" ? "bg-red-100 text-red-700" : risk === "warning" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
                            >
                              {risk === "breach"
                                ? "Breach Risk"
                                : risk === "warning"
                                  ? "Warning"
                                  : "Healthy"}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {canReview ? (
                              <div className="space-y-2">
                                <select
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                                  value={reviewRatings[row.id] || 5}
                                  onChange={(event) =>
                                    setReviewRatings((current) => ({
                                      ...current,
                                      [row.id]: Number(event.target.value),
                                    }))
                                  }
                                >
                                  {[1, 2, 3, 4, 5].map((item) => (
                                    <option value={item} key={item}>
                                      {item}/5
                                    </option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      reviewComplaint(row.id, true)
                                    }
                                    disabled={busyIds.includes(`rev-${row.id}`)}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      reviewComplaint(row.id, false)
                                    }
                                    disabled={busyIds.includes(`rev-${row.id}`)}
                                  >
                                    Dispute
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Waiting
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No complaints yet.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Community Leaderboard
            </h3>
            {communityLeaderboard.length ? (
              <ul className="space-y-2">
                {communityLeaderboard.map((item, index) => (
                  <li
                    key={item.community}
                    className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <Trophy size={14} /> {index + 1}. {item.community}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      Score {item.score}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No community data yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Workflow Alerts
            </h3>
            {logs.length ? (
              <ul className="space-y-2">
                {logs.slice(0, 8).map((entry, index) => (
                  <li
                    key={`${entry}-${index}`}
                    className="rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                    {entry}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No alerts yet.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
