"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";

import { ReactBitsChip } from "@/components/civic/reactbits-chip";
import { Button } from "@/components/ui/button";
import { CameraModal } from "@/components/civic/camera-modal";
import { ImageModal } from "@/components/civic/image-modal";

const STATE_BADGE = {
  Reported: "bg-slate-100 text-slate-700",
  "Pre-Validation": "bg-indigo-100 text-indigo-700",
  Assigned: "bg-cyan-100 text-cyan-700",
  "In Progress": "bg-lime-100 text-lime-700",
  "Work Uploaded": "bg-sky-100 text-sky-700",
  "User Confirmation": "bg-fuchsia-100 text-fuchsia-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

function badgeClass(state) {
  return STATE_BADGE[state] || "bg-slate-100 text-slate-700";
}

function displayStateLabel(state) {
  const normalizedState = String(state || "").replace(/^AI\s+/, "");
  if (normalizedState === "User Confirmation")
    return "waiting for user confirmation";
  return normalizedState;
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

let leafletLoaderPromise = null;

function ensureLeafletLoaded() {
  if (typeof window === "undefined") return Promise.resolve(null);

  if (window.L) return Promise.resolve(window.L);

  if (!leafletLoaderPromise) {
    leafletLoaderPromise = new Promise((resolve, reject) => {
      const existingCss = document.querySelector(
        'link[data-leaflet="civic-admin"]',
      );
      if (!existingCss) {
        const leafletCss = document.createElement("link");
        leafletCss.rel = "stylesheet";
        leafletCss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        leafletCss.setAttribute("data-leaflet", "civic-admin");
        document.head.appendChild(leafletCss);
      }

      const existingScript = document.querySelector(
        'script[data-leaflet="civic-admin"]',
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.L), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Failed to load Leaflet script")),
          { once: true },
        );
        return;
      }

      const leafletScript = document.createElement("script");
      leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      leafletScript.async = true;
      leafletScript.setAttribute("data-leaflet", "civic-admin");
      leafletScript.onload = () => resolve(window.L);
      leafletScript.onerror = () =>
        reject(new Error("Failed to load Leaflet script"));
      document.body.appendChild(leafletScript);
    });
  }

  return leafletLoaderPromise;
}

export default function AdminDashboardPage() {
  const [complaints, setComplaints] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [sessionUser, setSessionUser] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [mapError, setMapError] = useState("");

  const [authorityFilter, setAuthorityFilter] = useState("all");
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedTechnicianByComplaint, setSelectedTechnicianByComplaint] =
    useState({});
  const [techSubmission, setTechSubmission] = useState({});
  const [cameraOpen, setCameraOpen] = useState(null);
  const [imageModal, setImageModal] = useState({
    isOpen: false,
    title: "",
    src: "",
  });
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  const setBusy = (id, value) => {
    setBusyIds((current) => {
      if (value && !current.includes(id)) return [...current, id];
      if (!value) return current.filter((item) => item !== id);
      return current;
    });
  };

  const toImageUrl = (relativePath) => {
    if (!relativePath) return "";
    return `/api/images/${relativePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
  };

  const openImageModal = (title, relativePath) => {
    const src = toImageUrl(relativePath);
    if (!src) return;
    setImageModal({ isOpen: true, title, src });
  };

  const applyStore = (store) => {
    setComplaints(store.complaints ?? []);
    setTechnicians(store.technicians ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [bootstrapResponse, sessionResponse] = await Promise.all([
          fetch("/api/bootstrap", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

        if (!bootstrapResponse.ok)
          throw new Error("Failed to load bootstrap state");

        if (sessionResponse.ok) {
          const sessionPayload = await sessionResponse.json();
          setSessionUser(sessionPayload.user ?? null);
        }

        const store = await bootstrapResponse.json();
        applyStore(store);
        if (store.complaints?.length)
          setSelectedComplaintId(store.complaints[0].id);
      } catch {
        setFeedback({ type: "error", text: "Unable to load server state." });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const authorityRows = useMemo(() => {
    if (authorityFilter === "all") return complaints;
    return complaints.filter((item) => item.department === authorityFilter);
  }, [authorityFilter, complaints]);

  const selectedComplaint = useMemo(
    () => complaints.find((item) => item.id === selectedComplaintId),
    [complaints, selectedComplaintId],
  );

  const assignedForTechnicians = useMemo(
    () => complaints.filter((item) => item.assignedTechnicianId),
    [complaints],
  );

  const openLocationPoints = useMemo(
    () =>
      complaints
        .filter((item) => item.state !== "Closed")
        .map((item) => ({
          ...item,
          lat: Number(item?.location?.lat),
          lng: Number(item?.location?.lng),
        }))
        .filter(
          (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng),
        ),
    [complaints],
  );

  const unresolvedCount = useMemo(
    () => complaints.filter((item) => item.state !== "Closed").length,
    [complaints],
  );

  const selectedTechnicianId = selectedComplaintId
    ? selectedTechnicianByComplaint[selectedComplaintId] ||
      selectedComplaint?.assignedTechnicianId ||
      technicians[0]?.id ||
      ""
    : "";

  useEffect(() => {
    if (!selectedComplaintId) return;
    if (!technicians.length) return;

    setSelectedTechnicianByComplaint((current) => {
      if (current[selectedComplaintId]) return current;
      const defaultTechnicianId =
        selectedComplaint?.assignedTechnicianId || technicians[0]?.id;
      if (!defaultTechnicianId) return current;
      return {
        ...current,
        [selectedComplaintId]: defaultTechnicianId,
      };
    });
  }, [
    selectedComplaintId,
    selectedComplaint?.assignedTechnicianId,
    technicians,
  ]);

  useEffect(() => {
    let disposed = false;

    const renderMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const Leaflet = await ensureLeafletLoaded();
        if (!Leaflet || disposed) return;

        if (!mapRef.current) {
          mapRef.current = Leaflet.map(mapContainerRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
          }).setView([28.6139, 77.209], 12);

          Leaflet.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
              maxZoom: 19,
              attribution: "&copy; OpenStreetMap contributors",
            },
          ).addTo(mapRef.current);

          markerLayerRef.current = Leaflet.layerGroup().addTo(mapRef.current);
        }

        const markerLayer = markerLayerRef.current;
        markerLayer.clearLayers();

        if (!openLocationPoints.length) {
          setMapError("");
          return;
        }

        const bounds = Leaflet.latLngBounds([]);
        openLocationPoints.forEach((point) => {
          const marker = Leaflet.marker([point.lat, point.lng]);
          marker.bindPopup(
            `<div style="min-width:180px"><strong>${point.id}</strong><br/>${point.title}<br/>Status: ${displayStateLabel(point.state)}<br/>Department: ${point.department || "General"}</div>`,
          );
          marker.addTo(markerLayer);
          bounds.extend([point.lat, point.lng]);
        });

        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 15,
          });
        }

        setMapError("");
      } catch {
        setMapError("Map failed to load. Check internet connection and retry.");
      }
    };

    renderMap();

    return () => {
      disposed = true;
    };
  }, [openLocationPoints]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
      }
    },
    [],
  );

  const normalizeCoordinates = (coordinates) => {
    if (!coordinates || typeof coordinates !== "object") return null;
    const latCandidate =
      coordinates.lat ?? coordinates.latitude ?? coordinates.Latitude;
    const lngCandidate =
      coordinates.lng ?? coordinates.longitude ?? coordinates.Longitude;
    const lat = Number(latCandidate);
    const lng = Number(lngCandidate);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  const readCurrentCoordinates = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 },
      );
    });

  const callAndApply = async (url, options = {}, fallbackMessage) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      let errorMessage = fallbackMessage || "Request failed";
      try {
        const errorPayload = await response.json();
        if (errorPayload?.message) {
          errorMessage = errorPayload.message;
        }
      } catch {
        // Use fallback message when response body is not JSON
      }
      throw new Error(errorMessage);
    }
    const payload = await response.json();
    const nextStore = payload.store || payload;
    applyStore(nextStore);
    return payload;
  };

  const submitTechnicianWork = async (complaint) => {
    const details = techSubmission[complaint.id] || {};
    if (!details.proofCaptured || !details.scanConfirmed) {
      setFeedback({
        type: "warning",
        text: "Technician must capture proof and scan before submit.",
      });
      return;
    }

    if (!details.afterImageFile) {
      setFeedback({
        type: "warning",
        text: "Please upload after-work image before submit.",
      });
      return;
    }

    setBusy(`tech-${complaint.id}`, true);
    try {
      const formData = new FormData();
      formData.append("proofCaptured", String(details.proofCaptured));
      formData.append("scanConfirmed", String(details.scanConfirmed));

      formData.append("afterImage", details.afterImageFile);
      if (details.afterImageCapturedAt) {
        formData.append("afterCapturedAt", details.afterImageCapturedAt);
      }
      let normalizedCoordinates = normalizeCoordinates(
        details.afterImageCoordinates,
      );
      if (!normalizedCoordinates) {
        normalizedCoordinates = await readCurrentCoordinates();
      }
      if (!normalizedCoordinates) {
        normalizedCoordinates = normalizeCoordinates(complaint.location);
      }
      if (normalizedCoordinates) {
        formData.append("afterLatitude", String(normalizedCoordinates.lat));
        formData.append("afterLongitude", String(normalizedCoordinates.lng));
      }

      await callAndApply(
        `/api/complaints/${complaint.id}/technician-submit`,
        { method: "POST", body: formData },
        "Technician submission failed",
      );

      setFeedback({
        type: "success",
        text: "Technician work submitted successfully.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Technician submission failed.",
      });
    } finally {
      setBusy(`tech-${complaint.id}`, false);
    }
  };

  const assignComplaint = async () => {
    if (!selectedComplaintId) return;
    if (!selectedTechnicianId) {
      setFeedback({ type: "warning", text: "Please select a technician." });
      return;
    }

    setBusy(`assign-${selectedComplaintId}`, true);
    try {
      await callAndApply(
        `/api/complaints/${selectedComplaintId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ technicianId: selectedTechnicianId }),
        },
        "Assignment failed",
      );

      setFeedback({
        type: "success",
        text: `Complaint assigned to ${selectedTechnicianId}.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error.message || "Assignment failed.",
      });
    } finally {
      setBusy(`assign-${selectedComplaintId}`, false);
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
        <div className="flex items-start justify-end gap-3">
          <div className="flex flex-col items-end gap-2">
            <Pill tone="purple">
              {sessionUser?.displayName || "Authority Admin"}
            </Pill>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ReactBitsChip />
          <Pill>Authority workflow</Pill>
          <Pill tone="purple">Technician workflow</Pill>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              Active Problem Map
            </h3>
            <Pill tone="purple">Open complaints: {unresolvedCount}</Pill>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Live locations of all unresolved complaints. Click markers to view
            complaint details.
          </p>
          {mapError ? <Notice type="error">{mapError}</Notice> : null}
          {!openLocationPoints.length ? (
            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No unresolved complaints with valid coordinates.
            </div>
          ) : null}
          <div
            ref={mapContainerRef}
            className="mt-3 h-115 w-full overflow-hidden rounded-xl border border-slate-200"
          />
        </div>

        {feedback.text ? (
          <Notice type={feedback.type}>{feedback.text}</Notice>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Local Body Authority Controls
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Review complaints by department and open image evidence quickly.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">
                Department:
              </span>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={authorityFilter}
                onChange={(event) => setAuthorityFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="Roads">Roads</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Utilities">Utilities</option>
                <option value="Sewage">Sewage</option>
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Complaint</th>
                  <th className="px-3 py-3 font-medium">Reporter</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Images</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      Loading complaints...
                    </td>
                  </tr>
                ) : authorityRows.length ? (
                  authorityRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 align-top transition-colors hover:bg-slate-50 ${selectedComplaintId === row.id ? "bg-slate-50" : ""}`}
                      onClick={() => setSelectedComplaintId(row.id)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{row.id}</p>
                        <p className="mt-0.5 text-slate-600">{row.title}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {row.department || "General"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.reporterName || "Unknown"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(row.state)}`}
                        >
                          {displayStateLabel(row.state)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.imagePath ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openImageModal(
                                  `${row.id} - Reported Problem`,
                                  row.imagePath,
                                )
                              }
                              sx={{
                                px: 2.5,
                                py: 1,
                                borderRadius: 1.5,
                                textTransform: "none",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                borderColor: "primary.main",
                                color: "primary.main",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  borderColor: "primary.dark",
                                  bgcolor: "rgba(156, 213, 255, 0.08)",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 2px 8px rgba(156, 213, 255, 0.2)",
                                },
                              }}
                            >
                              View Problem Image
                            </Button>
                          ) : null}
                          {row.afterEvidence?.imagePath ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openImageModal(
                                  `${row.id} - Completed Work`,
                                  row.afterEvidence.imagePath,
                                )
                              }
                              sx={{
                                px: 2.5,
                                py: 1,
                                borderRadius: 1.5,
                                textTransform: "none",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                borderColor: "success.main",
                                color: "success.main",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  borderColor: "success.dark",
                                  bgcolor: "rgba(76, 175, 80, 0.08)",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 2px 8px rgba(76, 175, 80, 0.2)",
                                },
                              }}
                            >
                              View Completed Image
                            </Button>
                          ) : null}
                          {!row.imagePath && !row.afterEvidence?.imagePath ? (
                            <span className="text-xs text-slate-500">
                              No images
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      No complaints found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Selected Problem Details
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="min-w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={selectedComplaintId || ""}
              onChange={(event) => setSelectedComplaintId(event.target.value)}
            >
              {complaints.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.id} - {item.title}
                </option>
              ))}
            </select>
            {selectedComplaint?.imagePath ? (
              <Button
                variant="outline"
                onClick={() =>
                  openImageModal(
                    `${selectedComplaint.id} - Reported Problem`,
                    selectedComplaint.imagePath,
                  )
                }
                sx={{
                  px: 2.5,
                  py: 1,
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  borderColor: "primary.main",
                  color: "primary.main",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: "primary.dark",
                    bgcolor: "rgba(156, 213, 255, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 2px 8px rgba(156, 213, 255, 0.2)",
                  },
                }}
              >
                View Problem Image
              </Button>
            ) : null}
            {selectedComplaint?.afterEvidence?.imagePath ? (
              <Button
                variant="outline"
                onClick={() =>
                  openImageModal(
                    `${selectedComplaint.id} - Completed Work`,
                    selectedComplaint.afterEvidence.imagePath,
                  )
                }
                sx={{
                  px: 2.5,
                  py: 1,
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  borderColor: "success.main",
                  color: "success.main",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: "success.dark",
                    bgcolor: "rgba(76, 175, 80, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 2px 8px rgba(76, 175, 80, 0.2)",
                  },
                }}
              >
                View Completed Image
              </Button>
            ) : null}
            <select
              className="min-w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={selectedTechnicianId}
              onChange={(event) => {
                if (!selectedComplaintId) return;
                setSelectedTechnicianByComplaint((current) => ({
                  ...current,
                  [selectedComplaintId]: event.target.value,
                }));
              }}
              disabled={!selectedComplaintId}
            >
              <option value="">Select technician</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.id} - {technician.name}
                </option>
              ))}
            </select>
            <Button
              onClick={assignComplaint}
              disabled={
                !selectedComplaintId ||
                !selectedTechnicianId ||
                busyIds.includes(`assign-${selectedComplaintId}`)
              }
              sx={{
                px: 3,
                py: 1.2,
                borderRadius: 1.5,
                textTransform: "none",
                fontSize: "0.875rem",
                fontWeight: 600,
                bgcolor: "primary.main",
                color: "common.white",
                boxShadow: "0 2px 8px rgba(156, 213, 255, 0.3)",
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: "primary.dark",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(156, 213, 255, 0.4)",
                },
                "&:disabled": {
                  bgcolor: "action.disabledBackground",
                  color: "action.disabled",
                  boxShadow: "none",
                },
              }}
            >
              Assign & Set Status
            </Button>
          </div>

          {selectedComplaint ? (
            <div className="mt-4 grid gap-2 rounded-md border border-slate-100 p-3 text-sm text-slate-700 md:grid-cols-2">
              <p>
                <span className="font-medium">Complaint ID:</span>{" "}
                {selectedComplaint.id}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(selectedComplaint.state)}`}
                >
                  {displayStateLabel(selectedComplaint.state)}
                </span>
              </p>
              <p>
                <span className="font-medium">User:</span>{" "}
                {selectedComplaint.reporterName || "Unknown"}
              </p>
              <p>
                <span className="font-medium">Location:</span>{" "}
                {selectedComplaint.ward}
              </p>
              <p>
                <span className="font-medium">Type:</span>{" "}
                {selectedComplaint.category}
              </p>
              <p>
                <span className="font-medium">Department:</span>{" "}
                {selectedComplaint.department || "General"}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a complaint.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Technician Panel
          </h3>
          <div className="mt-3">
            <Notice>
              Technician completion workflow: open camera, capture evidence,
              submit after-work image from the complaint location.
            </Notice>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {assignedForTechnicians.length ? (
              assignedForTechnicians.map((complaint) => {
                const details = techSubmission[complaint.id] || {
                  proofCaptured: false,

                  afterImageFile: null,
                };
                const afterImageCoordinates = normalizeCoordinates(
                  details.afterImageCoordinates,
                );

                return (
                  <div
                    key={complaint.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {complaint.id} · {complaint.title}
                      </h4>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(complaint.state)}`}
                      >
                        {displayStateLabel(complaint.state)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700">
                      Assigned Technician: {complaint.assignedTechnicianId}
                    </p>
                    <p className="text-sm text-slate-500">
                      Department: {complaint.department || "General"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {complaint.imagePath ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            openImageModal(
                              `${complaint.id} - Reported Problem`,
                              complaint.imagePath,
                            )
                          }
                          sx={{
                            px: 2.5,
                            py: 1,
                            borderRadius: 1.5,
                            textTransform: "none",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            borderColor: "primary.main",
                            color: "primary.main",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              borderColor: "primary.dark",
                              bgcolor: "rgba(156, 213, 255, 0.08)",
                              transform: "translateY(-1px)",
                              boxShadow: "0 2px 8px rgba(156, 213, 255, 0.2)",
                            },
                          }}
                        >
                          View Problem Image
                        </Button>
                      ) : null}
                      {complaint.afterEvidence?.imagePath ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            openImageModal(
                              `${complaint.id} - Completed Work`,
                              complaint.afterEvidence.imagePath,
                            )
                          }
                          sx={{
                            px: 2.5,
                            py: 1,
                            borderRadius: 1.5,
                            textTransform: "none",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            borderColor: "success.main",
                            color: "success.main",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              borderColor: "success.dark",
                              bgcolor: "rgba(76, 175, 80, 0.08)",
                              transform: "translateY(-1px)",
                              boxShadow: "0 2px 8px rgba(76, 175, 80, 0.2)",
                            },
                          }}
                        >
                          View Completed Image
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => setCameraOpen(complaint.id)}
                        sx={{
                          px: 2.5,
                          py: 1,
                          borderRadius: 1.5,
                          textTransform: "none",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          borderColor: "secondary.main",
                          color: "secondary.main",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            borderColor: "secondary.dark",
                            bgcolor: "rgba(28, 29, 31, 0.05)",
                            transform: "translateY(-1px)",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                          },
                        }}
                      >
                        <Camera size={16} />
                        {details.afterImageFile
                          ? "Photo Captured"
                          : "Open Camera"}
                      </Button>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {details.afterImageFile
                        ? `After image: ${details.afterImageFile.name}`
                        : "No after-work image selected"}
                    </p>
                    {afterImageCoordinates ? (
                      <p className="text-xs text-slate-500">
                        📍 {afterImageCoordinates.lat.toFixed(5)},{" "}
                        {afterImageCoordinates.lng.toFixed(5)}
                      </p>
                    ) : null}

                    <div className="mt-3">
                      <Button
                        onClick={() => submitTechnicianWork(complaint)}
                        disabled={busyIds.includes(`tech-${complaint.id}`)}
                        sx={{
                          px: 3,
                          py: 1.2,
                          borderRadius: 1.5,
                          textTransform: "none",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          bgcolor: "primary.main",
                          color: "common.white",
                          boxShadow: "0 2px 8px rgba(156, 213, 255, 0.3)",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            bgcolor: "primary.dark",
                            transform: "translateY(-1px)",
                            boxShadow: "0 4px 12px rgba(156, 213, 255, 0.4)",
                          },
                          "&:disabled": {
                            bgcolor: "action.disabledBackground",
                            color: "action.disabled",
                            boxShadow: "none",
                          },
                        }}
                      >
                        Submit Completion
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                No assigned complaints for technicians.
              </p>
            )}
          </div>
        </div>

        <CameraModal
          isOpen={cameraOpen !== null}
          onClose={() => setCameraOpen(null)}
          onCapture={(file, meta) => {
            if (cameraOpen !== null) {
              setTechSubmission((current) => ({
                ...current,
                [cameraOpen]: {
                  ...current[cameraOpen],
                  proofCaptured: true,
                  scanConfirmed: true,
                  afterImageFile: file,
                  afterImageCapturedAt:
                    meta?.capturedAt || new Date().toISOString(),
                  afterImageCoordinates: meta?.coordinates || null,
                },
              }));
            }
          }}
        />
        <ImageModal
          isOpen={imageModal.isOpen}
          title={imageModal.title}
          src={imageModal.src}
          onClose={() => setImageModal({ isOpen: false, title: "", src: "" })}
        />
      </section>
    </main>
  );
}
