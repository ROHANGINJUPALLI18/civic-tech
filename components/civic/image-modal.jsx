import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ImageModal({ isOpen, title, src, onClose }) {
  if (!isOpen || !src) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title || "Image preview"}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close image preview"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <img
            src={src}
            alt={title || "Complaint image"}
            className="max-h-[70vh] w-full rounded-md object-contain bg-slate-100"
          />
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
