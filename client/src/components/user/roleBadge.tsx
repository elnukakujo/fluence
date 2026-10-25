export default function RoleBadge({ isAdmin, blocked }: { isAdmin?: boolean; blocked?: boolean }) {
    if (blocked) {
        return <span className="badge whitespace-nowrap bg-danger/15 text-danger">Blocked</span>;
    }
    if (isAdmin) {
        return <span className="badge whitespace-nowrap bg-accent text-primary-foreground">Admin</span>;
    }
    return <span className="badge whitespace-nowrap">User</span>;
}
