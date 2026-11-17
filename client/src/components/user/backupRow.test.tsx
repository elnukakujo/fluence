// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BackupRow from "./backupRow";

const backup = { filename: "backup_fluence_20260101_120000.dump", size_mb: 1.5, created_at: "2026-01-01T12:00:00", is_latest: true };

describe("BackupRow download", () => {
    it("is an enabled link that downloads the dump from the admin endpoint", () => {
        render(<BackupRow backup={backup} onRestore={() => {}} onDelete={() => {}} disabled />);
        const link = screen.getByRole("link", { name: /download/i });
        expect(link).toHaveAttribute("href", `/api/backup/download/${backup.filename}`);
        expect(link).toHaveAttribute("download", backup.filename);
    });
});
