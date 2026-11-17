import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** Choose an option in the app's one dropdown the way a user does: open it, click the option by its visible text. */
export async function pick(box: HTMLElement, optionName: string | RegExp) {
    await userEvent.click(box);
    await userEvent.click(within(await screen.findByRole("listbox")).getByRole("option", { name: optionName }));
}

/** The visible option texts of an open or closed dropdown, in order. */
export async function optionTexts(box: HTMLElement) {
    await userEvent.click(box);
    const list = await screen.findByRole("listbox");
    const texts = within(list).getAllByRole("option").map((o) => o.textContent ?? "");
    await userEvent.keyboard("{Escape}");
    return texts;
}
