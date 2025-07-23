# Vexa Chrome Extension (MV3)

## What it does

- Loads an apply **package** from the Vexa Draft Inbox
- Prefills common form fields on the open job page
- **Never** clicks Submit / Apply for you

## Install (dev)

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select this folder (`apps/extension`)
4. Run the web app on `http://localhost:3000`
5. Prepare a draft → Draft Inbox → **Apply now**
6. On the job page, open the extension popup → **Prefill this page**

## Safety

`autoSubmit` is always `false` in server packages. The extension rejects packages that request auto-submit.
