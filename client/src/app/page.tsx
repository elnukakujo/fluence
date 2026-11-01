import { getUserById } from "@/api/user";
import { getDailyStatsHistory } from "@/api/dailyStats";
import AvailableLanguages from "@/components/language/availableLanguages";
import Invites from "@/components/collaboration/invites";
import ConsentRequests from "@/components/collaboration/consentRequests";
import NavButton from "@/components/layout/navButton";
import LoginForm from "@/components/user/loginForm";
import PracticeHeatmap from "@/components/language/practiceHeatmap";
import User from "@/interface/systemData/User";
import { getCurrentUserId } from "@/utils/user_cookie";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const userId = await getCurrentUserId();

  // No cookie -> show user picker
  if (!userId) {
    return (
      <main>
        <LoginForm />
      </main>
    );
  }

  const user: User | null = await getUserById(userId);

  // If user not found, fallback to picker
  if (!user) {
    return (
      <main>
        <LoginForm />
      </main>
    );
  }

  const history = await getDailyStatsHistory(userId);
  const t = await getTranslations("home");

  return (
    <main className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1>{t("greeting", { name: user.display_name || user.username })}</h1>
        <p className="text-muted">{t("whatToStudy")}</p>
      </header>
      <PracticeHeatmap history={history} />
      <Invites />
      <ConsentRequests />
      <AvailableLanguages />
      <NavButton path="/languages/new">
        <p>{t("createNewLanguage")}</p>
      </NavButton>
    </main>
  );
}
