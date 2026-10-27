import Link from "next/link";
import UserForm from "@/components/user/userForm";

export default function NewUserPage() {
    return (
        <main>
            <div className="flex min-h-[75vh] items-center justify-center">
                <section className="card flex w-full max-w-md flex-col gap-6 p-8">
                    <header className="flex flex-col items-center gap-2 text-center">
                        <h1 className="text-3xl">Fluence</h1>
                        <p className="text-sm text-muted">Create your account to start learning.</p>
                    </header>

                    <UserForm />

                    <footer className="text-center text-sm text-muted">
                        Already registered? <Link href="/">Sign in</Link>
                    </footer>
                </section>
            </div>
        </main>
    );
}
