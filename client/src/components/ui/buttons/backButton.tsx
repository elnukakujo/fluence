"use client";

import { useRouter } from "next/navigation";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { popBackTarget } from "@/lib/navHistory";

export default function BackButton({ children, ariaLabel, onBefore, fromHistory = false }: { children?: React.ReactNode; ariaLabel?: string; onBefore?: () => void; /** Go to the last page the user visited (navbar); otherwise to the URL's parent. */ fromHistory?: boolean }) {
    const router = useRouter();
    const handleClick = () => {
        onBefore?.();
        const pathname = window.location.pathname;
        const previous = fromHistory ? popBackTarget(pathname) : null;
        if (previous) return router.push(previous);
        let parentPath = pathname.substring(0, pathname.lastIndexOf('/')) || '/';
        while (/(voc|gram|call|lesson|languages|new|ex|sources|tags|passage|character|word)$/.test(parentPath)) {
            parentPath = parentPath.substring(0, parentPath.lastIndexOf('/')) || '/';
        }
        router.push(parentPath);
    };

    return (
        <button
        className="btn btn-secondary min-h-11 min-w-11"
        aria-label={ariaLabel}
        onClick={handleClick}
        >
            <FontAwesomeIcon icon={faArrowLeft} />
            {children}
        </button>
    );
}