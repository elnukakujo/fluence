"use client";

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

/** A labelled form row: the visible label, the one control it wraps (input, select or textarea), and an optional hint and error.
 *  The label points at the control by id; hint and error are referenced with `aria-describedby` and stay out of the label, so the
 *  control's accessible name is just its label. */
export default function Field({ label, hint, error, children, className = "" }: {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    children: ReactElement<ControlProps>;
    className?: string;
}) {
    const generated = useId();
    const id = children.props.id ?? generated;
    const hintId = hint ? `${generated}-hint` : undefined;
    const errorId = error ? `${generated}-error` : undefined;
    const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
    return (
        <div className={`flex flex-col gap-1 ${className}`.trim()}>
            <label htmlFor={id} className="field-label">{label}</label>
            {cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : children.props["aria-invalid"] })}
            {hint && <p id={hintId} className="text-sm text-muted">{hint}</p>}
            {error && <p id={errorId} role="alert" className="text-sm text-danger">{error}</p>}
        </div>
    );
}
