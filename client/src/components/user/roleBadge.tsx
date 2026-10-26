export default function RoleBadge({ isAdmin, approved, blocked }: { isAdmin?: boolean; approved?: boolean; blocked?: boolean }) {
    if (blocked) {
        return <span className="badge whitespace-nowrap bg-danger/15 text-danger">Blocked</span>;
    }
    if (approved === false) {
        return <span className="badge whitespace-nowrap bg-warning/15 text-warning">Pending</span>;
    }
    if (isAdmin) {
        return <span className="badge whitespace-nowrap bg-accent text-primary-foreground">Admin</span>;
    }
    return <span className="badge whitespace-nowrap">User</span>;
}
