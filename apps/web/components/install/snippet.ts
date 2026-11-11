/** The steps shown under the snippet (project.md §6.9). */
export const INSTALL_STEPS = [
  "Copy the snippet.",
  "Paste it just before </body> on every page where the chat should appear.",
  "Reload your site. The chat button shows in the corner.",
] as const;

/**
 * The script tag an owner pastes on their site. `appUrl` is an origin from
 * `lib/app-url`, and the key is a `pk_` public key (letters, digits, `_`, `-`),
 * so neither needs escaping inside the attribute.
 */
export function installSnippet(appUrl: string, publicKey: string): string {
  return `<script src="${appUrl}/widget.js" data-key="${publicKey}" async></script>`;
}
