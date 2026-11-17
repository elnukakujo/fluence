/** A small tile: a caption over one value. Use inside `.stat-chips`. */
export default function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="stat-chip">
            <span>{label}</span>
            <strong>{children}</strong>
        </div>
    );
}
