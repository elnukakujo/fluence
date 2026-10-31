"use client";

import { useEffect, useState } from "react";

// The chosen file shown before upload so the user can find the first and last page. The browser's own PDF viewer
// gives scrolling and zoom; `page` jumps to the first page of the range.
export default function FilePreview({ file, page }: { file: File; page?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  return isPdf ? (
    <div className="flex flex-col gap-2">
      <iframe title={`Preview of ${file.name}`} src={`${url}#page=${page && page > 0 ? page : 1}`} className="h-[60vh] w-full rounded border border-gray-300 bg-white dark:border-gray-700" />
      {/* phones often cannot show a PDF inside a page */}
      <a href={url} target="_blank" rel="noreferrer" className="link text-sm underline">Open the document in a new tab</a>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Preview of ${file.name}`} className="max-h-[60vh] w-full rounded border border-gray-300 object-contain dark:border-gray-700" />
  );
}
