# Releasing

Pushing a `v*` tag runs `.github/workflows/release.yml`: it verifies the commit, packages the
extension, publishes a GitHub Release with the ZIP attached, and records the SHA-256 in the run
summary.

Nothing in the workflow talks to the Chrome Web Store. Uploading and publishing stay manual, so a
mistyped tag can never put an unreviewed version in front of your users.

## Releasing

```bash
# 1. Bump the version. The tag is the source of truth, so the two must agree.
npm version patch          # or: npm version minor / major
git push origin main

# 2. Tag the merge commit and push the tag. This is what starts the release.
git tag v0.2.0
git push origin v0.2.0
```

The workflow fails if the tag and `package.json` disagree, so a mistyped tag costs a run rather than
a mismatched artifact. It also re-runs lint, type checking and the test suite before packaging, and
attaches the ZIP plus its SHA-256 to the GitHub Release.

## Publishing to the store

Download the ZIP from the GitHub Release (or the run summary's `extension-zip` artifact), then:

1. Open the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole).
2. Pick the existing Side View item and upload the ZIP.
3. Verify the version number matches, fill in the release notes, press **Publish**.

The first upload of a new version can take several minutes to be accepted by Google before it shows
up in the dashboard; this is normal.

Verify the SHA-256 before uploading:

```bash
sha256sum side-view-0.2.0-chrome.zip
```

## Day-to-day

`CI` runs lint, type checking and tests on every push to `main` and on every pull request. It needs no
secrets and is the only workflow that runs on ordinary commits — the release workflow is tag-only, so
a normal merge never produces a release.
