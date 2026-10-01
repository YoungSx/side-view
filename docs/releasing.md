# Releasing

Pushing a `v*` tag runs `.github/workflows/release.yml`: it verifies the commit, packages the
extension, publishes a GitHub Release, and uploads the ZIP to the Chrome Web Store **as a draft**.

The workflow never calls the publish API. The new version waits in the dashboard until you press
**Publish**. Reviewing the store listing before it goes live is the point of the split.

## One-time setup

The upload needs five repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CWS_CLIENT_ID` | OAuth 2.0 client ID from the Google Cloud project linked to your Web Store developer account. |
| `CWS_CLIENT_SECRET` | That client's secret. |
| `CWS_REFRESH_TOKEN` | Long-lived refresh token, see below. |
| `CWS_EXTENSION_ID` | Your extension ID. For Side View it is already public: `hbplammjgakmogfiaobijlngllblpjhm`. |
| `CWS_PUBLISHER_ID` | Your publisher ID, a number unique to the developer account. |

`CWS_PUBLISHER_ID` is the one value that is hard to look up — the v1 API's `/publishers` list endpoint
is gone, so read it from the **Chrome Web Store dashboard → your account name / settings**, where the
publisher ID is shown next to the account name. Do not guess it; a wrong value fails the upload with
a `404`.

The refresh token comes from the OAuth consent flow with the
`https://www.googleapis.com/auth/chromewebstore` scope. This is a one-time manual step:

1. Enable the **Chrome Web Store API** in the Google Cloud project behind your developer account.
2. Create an OAuth 2.0 client of type **Web application** and record its ID and secret.
3. Authorize once with that client and the scope above, then exchange the resulting code for a
   refresh token. `gcloud auth application-default print-access-token` is not enough — the upload
   needs a *refresh* token, so keep the client secret available for the token exchange.

Credentials belong in secrets only. Nothing in this repository, and no workflow log, should ever
contain them.

## Releasing

```bash
# 1. Bump the version. The tag is the source of truth, so the two must agree.
npm version patch          # or: npm version minor / major
git push origin main

# 2. Tag the merge commit and push the tag. This is what starts the release.
git tag v0.1.2
git push origin v0.1.2
```

The workflow fails if the tag and `package.json` disagree, so a mistyped tag costs a run rather than
a wrong version in the store. It also re-runs lint, type checking and the test suite before
uploading, and attaches the ZIP plus its SHA-256 to the GitHub Release.

Then open the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole), check the
drafted version, and press **Publish**.

The first upload of a new version can take several minutes to be accepted by Google before it appears
as a draft; a `200` from the upload API only means the file was received.

## Day-to-day

`CI` runs lint, type checking and tests on every push to `main` and on every pull request. It needs no
secrets and is the only workflow that runs on ordinary commits — the release workflow is tag-only, so
a normal merge never touches the store.
