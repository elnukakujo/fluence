import { getUserById } from "@/api/user";
import { getDailyStatsHistory, getHomeStats } from "@/api/dailyStats";
import AvailableLanguages from "@/components/language/availableLanguages";
import Invites from "@/components/collaboration/invites";
import ConsentRequests from "@/components/collaboration/consentRequests";
import NavButton from "@/components/layout/navButton";
import LoginForm from "@/components/user/loginForm";
import PracticeHeatmap from "@/components/language/practiceHeatmap";
import HomeHeadline from "@/components/language/homeHeadline";
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
  const stats = await getHomeStats().catch(() => null);      // the page still works without the headline numbers
  const t = await getTranslations("home");

  return (
    <main className="flex flex-col gap-6">
      <header className="page-head">
        <div className="flex flex-col gap-1">
          <h1>{t("greeting", { name: user.display_name || user.username })}</h1>
          <p className="text-muted">{t("whatToStudy")}</p>
        </div>
        <NavButton path="/languages/new">
          <p>{t("createNewLanguage")}</p>
        </NavButton>
      </header>
      {stats && <HomeHeadline stats={stats} />}
      <Invites />
      <ConsentRequests />
      <div className="dash-grid">
        <div className="dash-main">
          <AvailableLanguages summaries={stats?.languages} title={t("yourLanguages")} />
        </div>
        <aside className="dash-aside">
          <PracticeHeatmap history={history} bands={stats?.heatmap_bands} weekDelta={stats?.week_delta} />
        </aside>
      </div>
    </main>
  );
}
