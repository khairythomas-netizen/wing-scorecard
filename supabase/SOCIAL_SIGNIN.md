# Google and Apple sign-in

Google is set up and live. Apple is not, and section 2 is what it would take.

The app already has the buttons. It asks Supabase which providers are switched
on and shows only those, so nothing here needs a code change or a redeploy —
finish a section below and the button appears on the next page load.

Everything in this file happens in a dashboard. None of it can be done from
the repo.

Two values you will paste repeatedly:

| Thing | Value |
| --- | --- |
| Supabase callback URL | `https://kukhjyecluksittmfyyi.supabase.co/auth/v1/callback` |
| The live app | `https://khairythomas-netizen.github.io/wing-scorecard/` |

## 0. Allow the app as a redirect target (do this first, once)

Supabase refuses to send anyone back to a URL it does not recognise, and the
app lives on a sub-path, so the origin alone is not enough.

In **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://khairythomas-netizen.github.io/wing-scorecard/`
- **Redirect URLs**: add both
  - `https://khairythomas-netizen.github.io/wing-scorecard/`
  - `http://localhost:5273/wing-scorecard/`

## 1. Google — done

Live since 10 September 2026. Nothing to do here unless something breaks.

| | |
| --- | --- |
| Google Cloud project | `wingz-508210`, named WingZ |
| OAuth client | `WingZ Web` |
| Publishing status | In production, so anyone with a Google account can sign in |
| User support email | `khairythomas@gmail.com` |
| Developer contact | `wingz_app@outlook.com` |

Two things to know about how it looks and behaves.

Google's sign-in page says "to continue to
`kukhjyecluksittmfyyi.supabase.co`" rather than "to continue to WingZ".
That is Supabase brokering the OAuth handshake, so Google shows Supabase's
hostname. The cure is a Supabase custom domain, which is a paid add-on.

The user support email is shown publicly on that screen. Google only accepts
the signed-in Google account or a Google Group, which is why it is a personal
Gmail rather than the project's Outlook address. Change it under **Branding**
if `wingz_app` ever becomes a Google account or a Group.

If Google sign-in ever stops working, check these in order: the client's
authorised redirect URI still matches the Supabase callback, the publishing
status is still In production, and the privacy and terms pages still return
200. Google unpublishes apps whose policy links go dead.

## 2. Apple

Apple charges for this. Sign In with Apple needs a **paid Apple Developer
Program membership**, currently 99 USD a year. If you are not paying for one
already, do Google first and leave this until the app is worth it.

All of it happens at
[developer.apple.com](https://developer.apple.com/account/resources/identifiers/list).

1. **Identifiers → + → App IDs → App**. Give it a description and a bundle ID
   such as `app.wingz`. Tick **Sign In with Apple**. Register it.
2. **Identifiers → + → Services IDs**. Description "WingZ Web", identifier
   `app.wingz.web`. Register, then open it again and tick **Sign In with
   Apple → Configure**:
   - *Primary App ID*: the App ID from step 1
   - *Domains and Subdomains*: `kukhjyecluksittmfyyi.supabase.co`
   - *Return URLs*: the Supabase callback URL from the table above
3. **Keys → +**. Name it "WingZ Sign In", tick **Sign In with Apple**,
   configure it against the same primary App ID, then Register and
   **Download** the `.p8` file. Apple lets you download it exactly once, so
   put it somewhere safe immediately.
4. Note three values: the **Key ID** (shown with the key), your **Team ID**
   (top right of the developer portal) and the **Services ID** from step 2.
5. **Supabase → Authentication → Sign In / Providers → Apple**: enable it and
   fill in the Services ID as the client ID, plus the Team ID, Key ID and the
   full text of the `.p8` file.

Two things worth knowing about Apple. It sends a person's name only on their
very first authorisation, which is why the app stores it straight away. And
anyone can choose "Hide My Email", so the address you receive may be an Apple
relay address rather than their real one. Both are handled.
