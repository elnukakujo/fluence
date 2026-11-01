import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, pickLocale } from "./locales";

export default getRequestConfig(async () => {
  const locale = pickLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get("accept-language"),
  );
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
