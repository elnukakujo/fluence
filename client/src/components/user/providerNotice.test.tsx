import { describe, expect, it } from "vitest";
import { unseenProviders } from "./providerNotice";

const ep = (base_url: string, is_active = true) => ({ base_url, is_active });

describe("unseenProviders", () => {
    it("asks once per active endpoint URL, ignoring trailing slashes", () => {
        expect(unseenProviders([ep("http://a.test/"), ep("http://a.test"), ep("http://b.test")], ["http://b.test/"]))
            .toEqual(["http://a.test"]);
    });
    it("ignores inactive endpoints and acknowledged ones", () => {
        expect(unseenProviders([ep("http://a.test", false)], [])).toEqual([]);
        expect(unseenProviders([ep("http://a.test")], ["http://a.test"])).toEqual([]);
    });
});
