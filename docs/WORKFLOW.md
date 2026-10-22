# Dayline website workflow

Dayline is a static website implemented with HTML, CSS, and JavaScript modules. GitHub is the current development repository and preview host; the deployable output is `dist/` and can move to another static host.

## Keep changes focused

1. Read the affected modules and preserve existing planner data and backup compatibility.
2. Keep scheduling, formatting, and session rules in their pure model modules; keep DOM behavior in the corresponding view modules.
3. Keep personality copy separate from user content. Changing presentation must not rewrite notes or saved commitments.
4. Keep music generation local and separate from session persistence. Preserve independent audio controls and predictable stop/fade behavior.
5. Use a feature branch and a focused pull request when collaborating. Describe behavior and relevant validation.

## Verify and publish

1. Run `npm run check` for application syntax.
2. Run `npm test` for behavior and regression checks. Add tests when they protect meaningful behavior.
3. Verify changed UI in the browser, including keyboard use, narrow layouts, persistence, and relevant recovery paths.
4. Publish the latest `main` through **Deploy GitHub Pages** while using the current development host. Older deployments do not need to run again: the latest commit contains earlier changes.
5. Verify both the deployment job result and the live page. A queued run is not proof of publication; record publication delays separately from code failures.

## Preserve the launch direction

- Keep guest planning usable without a paid hosting or account dependency.
- Treat optional account activation as a separate, deliberate change. Do not provision a service or enable costs as part of unrelated edits.
- Finalize the website before changing hosts or adding payments and ads.
- Use [WEB_RELEASE_PLAN.md](WEB_RELEASE_PLAN.md) to prepare free commercial hosting, the note-transfer process, supporter payments, paid extras, banners, and ad-free access.
