# Compass OOU

Campus information and navigation app for Olabisi Onabanjo University. React + Vite, plain CSS, Supabase (accounts, places, photos, analytics), hosted on Vercel.

Without Supabase keys the app runs in **test mode** (a yellow bar shows): accounts and edits stay on that one device and any 6 digits are accepted as the code. With the keys it is the real thing.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Go live: do these in order (about 45 minutes)

### 1. Supabase (the database and sign-in)
1. supabase.com > New project (free). Pick a region close to Nigeria (e.g. Europe/London), set a database password, wait for it to finish.
2. **SQL Editor > New query**: paste all of `supabase/schema.sql` > Run. Then a new query with `supabase/seed.sql` > Run. (This loads the 84 places and 45 coordinates.)
3. **Authentication > Providers > Email**: keep it on. Set "Email OTP length" to **6**. Turn **"Confirm email" off** (the code already proves the email).
4. **Authentication > Email Templates > "Magic Link"** (this is the template the code uses). Replace the body with:
   ```
   <h2>Your Compass code</h2>
   <p>Enter this code in the app: <b>{{ .Token }}</b></p>
   ```
   Do the same for the "Confirm signup" template. If the email has no `{{ .Token }}`, students get a link instead of a code.
5. **Authentication > URL Configuration**: set Site URL to your Vercel address (step 3). Add the same address plus `/` under Redirect URLs. Add `http://localhost:5173` too for local work.
6. **Project Settings > API**: copy the **Project URL** and the **anon public** key. (Never use the service_role key in this app.)
7. **Email sending (important before launch):** Supabase's built-in email only allows a few emails an hour. Go to Authentication > SMTP Settings and connect Brevo (free, 300 emails a day): create a Brevo account, add and verify a sender email, get the SMTP key, and paste the details into Supabase.
8. Optional Google sign-in: Authentication > Providers > Google. Create OAuth keys in Google Cloud Console (Credentials > OAuth client ID > Web) and paste the Client ID and secret. Use the callback URL Supabase shows you. Until this is done the "Continue with Google" button shows a friendly "not switched on yet" message.

### 2. GitHub
```
git remote add origin https://github.com/AfuwapeTemitayo/compass-oou.git
git push -u origin main
```
(Create an empty repo called compass-oou on GitHub first. Do not add a README there.)

### 3. Vercel
1. vercel.com > Add New > Project > import the `compass-oou` repo. Framework is detected as Vite. No other settings.
2. Before you press Deploy, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. Deploy. You get an address like `compass-oou.vercel.app`. Go back to Supabase step 5 and put that address in.
4. Any later change you push to GitHub redeploys by itself. If you change the env variables, press Redeploy.

### 4. Make yourself admin
1. Open the live site and register with **temmyteegraphic@gmail.com** (so the code goes to your inbox).
2. Supabase > SQL Editor: 
   ```
   update profiles set role = 'admin' where email = 'temmyteegraphic@gmail.com';
   ```
3. Refresh the app, tap your initials > **Admin dashboard**. You will see the Overview (real numbers), the Places list and Add place.

### 5. Keep Supabase awake (free plan pauses after about a week of no use)
In the GitHub repo: Settings > Secrets and variables > Actions > add `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The workflow in `.github/workflows/keepalive.yml` then pings it twice a week.

## Test checklist before you share the link
- [ ] Register with a second email, receive the 6-digit code, land on Home with My department filled in
- [ ] Sign out, then Sign in again with the code
- [ ] Directory search finds "FOS" and "ICT"
- [ ] Map: choose a From and a To, see minutes; Start asks for location; walk on campus and the arrow follows
- [ ] As admin: add a place with coordinates and a photo, then see it on the map from another account
- [ ] Admin Overview shows the new student and visits

## Where things are
```
src/pages        Welcome, Signup, SignIn, Verify (Auth.jsx), Home/Directory/Place/FAQ (Main.jsx), MapPage, Admin, Privacy
src/lib          backend.js (Supabase or test mode), routing.js (shortest path), mapEngine.js (map + live arrow), geo.js, places.js
src/data         roads.json (OpenStreetMap roads, buildings), seed.json (places used in test mode)
src/styles       app.css (the approved design: blue, gold, Space Grotesk)
supabase         schema.sql, seed.sql
```

## Notes
- Map data: © OpenStreetMap contributors. The credit is behind the "i" button on the map and must stay.
- Vercel Hobby is for non-commercial use. Fine for a student project.
- Edit the privacy page (`src/pages/Privacy.jsx`) and add a contact email before launch.
- Places without coordinates show "Coming soon". Add them from the admin Places list.
