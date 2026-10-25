import { getUserById } from "@/api/user";
import { getDailyStatsHistory } from "@/api/dailyStats";
import AvailableLanguages from "@/components/language/availableLanguages";
import NavButton from "@/components/layout/navButton";
import LoginForm from "@/components/user/loginForm";
import PracticeHeatmap from "@/components/language/practiceHeatmap";
import User from "@/interface/systemData/User";
import { getCurrentUserId } from "@/utils/user_cookie";

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

  return (
    <main className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1>Fluence</h1>
        <h2>Hey {user.display_name || user.username}! What do you want to study today?</h2>
      </header>
      <PracticeHeatmap history={history} />
      <AvailableLanguages />
      <NavButton path="/languages/new">
        <p>Create New Language</p>
      </NavButton>
    </main>
  );
}
