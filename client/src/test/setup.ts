import { vi } from "vitest";
import { translator } from "./intlMock";

vi.mock("next-intl", () => ({ useTranslations: translator, useLocale: () => "en" }));
vi.mock("next-intl/server", () => ({ getTranslations: async (ns?: string) => translator(ns) }));
