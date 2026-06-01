"use client";

import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";

interface DropZoneProps {
  file: File | null;
  onChange: (file: File) => void;
  accept?: string; // e.g. "application/pdf"
  label?: string;  // e.g. "PDF only"
}

export default function DropZone({
  file,
  onChange,
  accept = "application/pdf",
  label = "PDF only",
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onChange(dropped);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the zone entirely (not entering a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  };

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={() => setDragging(true)}
        onDragLeave={handleDragLeave}
        className={`w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-[#223149] bg-[#223149]/5"
            : "border-[#ECE3DF] hover:border-[#223149]/30 hover:bg-[#F8F6F4]"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-2 text-[#223149]">
            <FileText className="w-5 h-5 text-[#5F7C84] flex-shrink-0" />
            <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
          </div>
        ) : dragging ? (
          <>
            <Upload className="w-8 h-8 text-[#223149] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#223149]">Drop to upload</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-[#9BADB7] mx-auto mb-2" />
            <p className="text-sm text-[#5F7C84]">
              Click to select or drag & drop a file
            </p>
            <p className="text-xs text-[#9BADB7] mt-1">{label}</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
          // Reset so the same file can be re-selected after clearing
          e.target.value = "";
        }}
      />
    </>
  );
}
