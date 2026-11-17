import { getUserById } from "@/api/user";
import SettingsLayout from "@/components/user/settingsLayout";
import ProfileSection from "@/components/user/profileSection";
import PasswordSection from "@/components/user/passwordSection";
import PreferencesSection from "@/components/user/preferencesSection";
import StudyGoalsCard from "@/components/language/studyGoalCard";
import AiFeaturesSection from "@/components/user/aiFeaturesSection";
import ApiEndpointsSection from "@/components/user/apiEndpointsSection";
import { PaceSection, ReviewSection, AnswerSection, SeeSection } from "@/components/user/groupSections";
import SkillsSection from "@/components/user/skillsSection";
import { getAvailableLanguages } from "@/api/language";
import type Language from "@/interface/containers/Language";
import UploadsSection from "@/components/user/uploadsSection";
import BackupSection from "@/components/user/backupSection";
import LogsSection from "@/components/user/logsSection";
import RoleBadge from "@/components/user/roleBadge";
import UsersSection from "@/components/user/usersSection";

export default async function UpdateUserPage({ params }: { params: Promise<{ user_id: string }> }) {
    const { user_id } = await params;
    const user = await getUserById(user_id);
    const preferences = user.preferences ?? {};
    const endpoints = preferences.ai_endpoints ?? [];
    const languages = ((await getAvailableLanguages(user.id)) as Language[]).filter((l) => l.user_id === user.id).map((l) => ({ id: l.id!, name: l.name }));

    return (
        <SettingsLayout isAdmin={user.is_admin}>
            <header className="flex items-center gap-2">
                <h1 className="text-xl">{user.display_name || user.username}</h1>
                <RoleBadge isAdmin={user.is_admin} blocked={user.blocked} />
            </header>

            <section id="profile">
                <ProfileSection user={user} preferences={preferences} />
            </section>

            <section id="security">
                <PasswordSection userId={user.id} />
            </section>

            <section id="preferences">
                <PreferencesSection preferences={preferences} />
            </section>

            <section id="goals">
                <StudyGoalsCard userId={user.id} />
            </section>

            <section id="pace" className="flex flex-col gap-4"><PaceSection languages={languages} /></section>
            <section id="review"><ReviewSection languages={languages} /></section>
            <section id="answer"><AnswerSection languages={languages} /></section>
            <section id="see"><SeeSection languages={languages} /></section>
            <section id="skills"><SkillsSection /></section>

            <section id="ai-features">
                <AiFeaturesSection
                    prefId={preferences.id}
                    preferences={preferences}
                    hasEndpoints={endpoints.length > 0}
                />
            </section>

            <section id="api-endpoints">
                <ApiEndpointsSection
                    prefId={preferences.id}
                    endpoints={endpoints}
                    noticesSeen={preferences.provider_notices_seen ?? []}
                />
            </section>

            <section id="uploads">
                <UploadsSection />
            </section>

            {user.is_admin && (
                <>
                    <section id="users">
                        <UsersSection currentUserId={user.id} />
                    </section>

                    <section id="backups">
                        <BackupSection />
                    </section>

                    <section id="logs">
                        <LogsSection />
                    </section>
                </>
            )}
        </SettingsLayout>
    );
}
