import { useEffect, useRef } from "react";
import { deleteJob } from "@/api/ingestion";

/** Once everything wanted from an import has been added, leaving the page deletes the import (row, PDF, parse and candidates). */
export function useDeleteWhenFinished(jobId: string, finished: boolean) {
  const latest = useRef({ jobId, finished });
  latest.current = { jobId, finished };
  useEffect(() => () => {
    if (latest.current.finished) deleteJob(latest.current.jobId).catch(() => undefined);
  }, []);
}
