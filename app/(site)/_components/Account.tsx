import { Show, SignInButton, UserButton } from "@clerk/nextjs";

// Header account control. Browsing never needs it; following and alerts do.
export function Account() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="min-h-11 rounded-full px-3 text-sm font-semibold text-link hover:text-ink">
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <span className="flex min-h-11 items-center">
          <UserButton />
        </span>
      </Show>
    </>
  );
}
