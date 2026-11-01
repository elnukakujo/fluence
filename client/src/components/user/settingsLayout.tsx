import SettingsSidebar from "./settingsSidebar";

// Phone: sticky chip strip under the navbar + one full-width column.
// md+: 200px sticky sidebar beside the content.
export default function SettingsLayout({ children, isAdmin = false }: { children: React.ReactNode; isAdmin?: boolean }) {
  return (
    <div className="settings-page mx-auto flex max-w-5xl flex-col gap-3 pb-12 pt-0 md:flex-row md:gap-6 md:pt-4">
      <aside className="sticky top-14 z-30 -mx-4 min-w-0 min-[481px]:-mx-6 sm:top-16 md:top-24 md:z-auto md:mx-0 md:w-[200px] md:shrink-0 md:self-start">
        <SettingsSidebar isAdmin={isAdmin} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6 [&>section]:scroll-mt-32 md:[&>section]:scroll-mt-20">
        {children}
      </div>
    </div>
  );
}
