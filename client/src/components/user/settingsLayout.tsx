import SettingsSidebar from "./settingsSidebar";

export default function SettingsLayout({ children, isAdmin = false }: { children: React.ReactNode; isAdmin?: boolean }) {
  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto px-4 pt-4 pb-12">
      <aside className="md:sticky md:top-24 md:self-start md:w-[200px] shrink-0">
        <SettingsSidebar isAdmin={isAdmin} />
      </aside>
      <main className="flex-1 min-w-0 flex flex-col gap-6 [&>section]:scroll-mt-20">
        {children}
      </main>
    </div>
  );
}
