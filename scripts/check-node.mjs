/**
 * Preflight Node version check.
 *
 * Vite 8 needs Node ^20.19 || >=22.12. On anything older it dies inside its own
 * dependencies with "does not provide an export named 'styleText'", which looks
 * like a broken project rather than a wrong runtime. This runs before dev and
 * build to say what is actually wrong.
 *
 * Deliberately written in old, boring JS with no imports: it has to run on the
 * very Node versions it is designed to reject.
 */

const REQUIRED = '^20.19.0 || >=22.12.0'

const raw = process.versions.node
const [major, minor] = raw.split('.').map(Number)
const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22

if (!ok) {
  const line = '─'.repeat(64)
  process.stderr.write(
    `\n${line}\n` +
      `  Node ${raw} is too old for this project.\n` +
      `  Required: ${REQUIRED}  (Vite 8 enforces this)\n\n` +
      `  Fix it with nvm:\n` +
      `      nvm install 22 && nvm use 22\n\n` +
      `  Using conda? Its Node can shadow nvm's. Check with:\n` +
      `      which node\n` +
      `  and either 'conda deactivate' or:\n` +
      `      conda install -c conda-forge nodejs=22\n\n` +
      `  Then re-run: npm install && npm run dev\n` +
      `${line}\n\n`,
  )
  process.exit(1)
}
