import { getTranslations } from "next-intl/server";
import { getUserById } from "@/api/user";
import SettingsLayout from "@/components/user/settingsLayout";
import ProfileSection from "@/components/user/profileSection";
import PasswordSection from "@/components/user/passwordSection";
import PreferencesSection from "@/components/user/preferencesSection";
import SettingsSection from "@/components/user/settingsSection";
import CourseSettings from "@/components/user/courseSettings";
import { PaceBlock, AppearanceBlock, AnswerBlock } from "@/components/user/groupSections";
import StudyGoalsCard from "@/components/language/studyGoalCard";
import AiFeaturesSection from "@/components/user/aiFeaturesSection";
import ApiEndpointsSection from "@/components/user/apiEndpointsSection";
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
    const t = await getTranslations("settings.sections");
    const preferences = user.preferences ?? {};
    const endpoints = preferences.ai_endpoints ?? [];
    const languages = ((await getAvailableLanguages(user.id)) as Language[]).filter((l) => l.user_id === user.id).map((l) => ({ id: l.id!, name: l.name }));

    return (
        <SettingsLayout isAdmin={user.is_admin}>
            <header className="flex items-center gap-2">
                <h1 className="text-xl">{user.display_name || user.username}</h1>
                <RoleBadge isAdmin={user.is_admin} blocked={user.blocked} />
            </header>

            <SettingsSection id="profile" title={t("profile")}>
                <ProfileSection user={user} preferences={preferences} />
                <AppearanceBlock />
                <PasswordSection userId={user.id} />
            </SettingsSection>

            <SettingsSection id="learning" title={t("learning")} hint={t("learningHint")}>
                <PaceBlock />
                <StudyGoalsCard userId={user.id} />
            </SettingsSection>

            <SettingsSection id="ai" title={t("ai")} hint={t("aiHint")}>
                <ApiEndpointsSection prefId={preferences.id} endpoints={endpoints} noticesSeen={preferences.provider_notices_seen ?? []} />
                <AiFeaturesSection prefId={preferences.id} preferences={preferences} />
                <UploadsSection />
            </SettingsSection>

            <SettingsSection id="study" title={t("study")} hint={t("studyHint")}>
                <CourseSettings languages={languages} fold />
                <AnswerBlock />
                <PreferencesSection preferences={preferences} />
                <SkillsSection />
            </SettingsSection>

            {user.is_admin && (
                <SettingsSection id="admin" title={t("admin")}>
                    <UsersSection currentUserId={user.id} />
                    <BackupSection />
                    <LogsSection />
                </SettingsSection>
            )}
        </SettingsLayout>
    );
}
