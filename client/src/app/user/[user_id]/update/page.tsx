import { getUserById } from "@/api/user";
import SettingsLayout from "@/components/user/settingsLayout";
import ProfileSection from "@/components/user/profileSection";
import PasswordSection from "@/components/user/passwordSection";
import PreferencesSection from "@/components/user/preferencesSection";
import AiFeaturesSection from "@/components/user/aiFeaturesSection";
import ApiEndpointsSection from "@/components/user/apiEndpointsSection";
import BackupSection from "@/components/user/backupSection";
import LogsSection from "@/components/user/logsSection";
import RoleBadge from "@/components/user/roleBadge";
import UsersSection from "@/components/user/usersSection";

export default async function UpdateUserPage({ params }: { params: Promise<{ user_id: string }> }) {
    const { user_id } = await params;
    const user = await getUserById(user_id);
    const preferences = user.preferences ?? {};
    const endpoints = preferences.ai_endpoints ?? [];

    return (
        <SettingsLayout isAdmin={user.is_admin}>
            <header className="flex items-center gap-2">
                <h1 className="text-xl">{user.display_name || user.username}</h1>
                <RoleBadge isAdmin={user.is_admin} blocked={user.blocked} />
            </header>

            <section id="profile">
                <ProfileSection user={user} />
            </section>

            <section id="security">
                <PasswordSection userId={user.id} />
            </section>

            <section id="preferences">
                <PreferencesSection preferences={preferences} />
            </section>

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
                />
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
