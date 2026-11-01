"use client";

type DateDisplayProps = {
	date?: string | Date | null;
	locale?: string;
	options?: Intl.DateTimeFormatOptions;
	fallback?: string;
    message?: string;
    // Show the time alongside the date, with "Today" in place of today's date.
    withTime?: boolean;
    todayLabel?: string;
    atLabel?: string;
};

const defaultOptions: Intl.DateTimeFormatOptions = {
	year: "numeric",
	month: "short",
	day: "2-digit",
};

const dateWithTimeOptions: Intl.DateTimeFormatOptions = {
	year: "numeric",
	month: "short",
	day: "numeric",
};

const timeOptions: Intl.DateTimeFormatOptions = {
	hour: "numeric",
	minute: "2-digit",
};

function formatDate(
	date: string | Date | null | undefined,
	locale?: string,
	options?: Intl.DateTimeFormatOptions,
	withTime?: boolean,
	todayLabel?: string,
	atLabel?: string,
): string | null {
	if (!date) return null;

	const parsed = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(parsed.getTime())) return null;

	if (withTime) {
		const isToday = parsed.toDateString() === new Date().toDateString();
		const datePart = isToday ? (todayLabel || "Today") : new Intl.DateTimeFormat(locale, options ?? dateWithTimeOptions).format(parsed);
		const timePart = new Intl.DateTimeFormat(locale, timeOptions).format(parsed);
		return `${datePart} ${atLabel || "at"} ${timePart}`;
	}

	return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(parsed);
}

export default function DateDisplay({
	date,
	locale,
	options,
	fallback = "-",
    message,
    withTime,
    todayLabel = "Today",
    atLabel = "at",
}: DateDisplayProps) {
	const formattedDate = formatDate(date, locale, options, withTime, todayLabel, atLabel);

	return (
		<div className="inline-flex items-center gap-2">
			{message && <span className="text-sm text-muted">{message}</span>}
			<span className="text-sm">{formattedDate ?? fallback}</span>
		</div>
	);
}
