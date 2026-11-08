"use client";

import { Component, type ReactNode } from "react";

/** Safety net around an exercise runner: a broken exercise shows a message and a skip button instead of
 *  throwing to the app-level boundary (which would silently leave the review). Reset by changing `key`. */
export default class RunnerBoundary extends Component<{ children: ReactNode; onSkip: () => void; exerciseId?: string; message: string; skipLabel: string }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: unknown) { console.error(`Exercise ${this.props.exerciseId ?? "?"} failed to render`, error); }
    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="card flex flex-col gap-3" role="alert">
                <p>{this.props.message}</p>
                <button type="button" className="btn btn-primary min-h-11 self-start" onClick={this.props.onSkip}>{this.props.skipLabel}</button>
            </div>
        );
    }
}
