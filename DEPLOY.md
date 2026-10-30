# Publish the two portals with GitHub, Vercel, and Supabase

This is a front end with Vercel serverless API routes, backed by Supabase Auth/Postgres and Stripe Checkout. Configure the providers and server secrets before accepting bookings.

## 1. Create and configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor**, paste the contents of `supabase.sql`, and run it. The row-level security policies keep customer bookings private and allow only staff listed in `staff_members` to view or manage all bookings.
3. Set prices for each room in cents and currency using Supabase SQL. For example, `price_cents = 2500` means USD 25.00. All four rooms start with price zero; checkout is disabled for a room until a positive price is configured.
4. In **Project Settings → API**, copy the Project URL and anon/publishable key into `config.js`. Do not use or publish the `service_role` secret.
5. In **Authentication → Providers**, enable Google and Phone. Google OAuth also needs OAuth client credentials from Google Cloud, configured in Supabase.
6. In **Authentication → URL Configuration**, add your eventual Vercel URL to the allowed redirect URLs (for example, `https://your-site.vercel.app/**`).
7. Configure an SMS provider in Supabase for phone OTP delivery. SMS providers can charge per message.
8. Create staff accounts in Supabase Auth. Then add each approved staff email in the SQL Editor:

```sql
insert into public.staff_members (email) values ('employee@yourcompany.com');
```

Only add trusted staff. Staff can see customer contact details and manage every booking. Create accounts and remove access from Supabase Auth and `staff_members` as staff join or leave.

## 2. Configure Stripe and Vercel

1. Create a Stripe account and get its secret API key.
2. In Stripe, add a webhook endpoint at `https://YOUR-VERCEL-DOMAIN/api/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `checkout.session.async_payment_failed`. Copy its signing secret.
3. After importing this project into Vercel, set these environment variables in **Project Settings → Environment Variables**:

   - `SUPABASE_URL` — same project URL used in `config.js`
   - `SUPABASE_ANON_KEY` — same anon/publishable key used in `config.js`
   - `SUPABASE_SERVICE_ROLE_KEY` — private Supabase service role key (server only)
   - `STRIPE_SECRET_KEY` — private Stripe secret API key
   - `STRIPE_WEBHOOK_SECRET` — Stripe endpoint signing secret

Redeploy after setting environment variables. Never add the Supabase service-role key or Stripe secret to browser code or GitHub.

## 3. Push the website to GitHub

Unzip `escape-mansion-booking-portals.zip` into a folder, or use these files directly. From that folder:

```sh
git init
git add .
git commit -m "Add Escape Mansion booking portals"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your GitHub repository URL.

## 4. Deploy from Vercel

1. In Vercel, choose **Add New → Project**, then import the GitHub repository.
2. Choose **Other** as the framework preset. Leave build and install commands blank. Use `.` as the output directory if prompted.
3. Deploy. The root URL opens the customer portal. `/employee.html` opens the staff portal.
4. Add the final Vercel domain in Supabase Auth's allowed redirect URLs and in Stripe's webhook endpoint, then test Google, SMS sign-in, and a Stripe test-mode booking.

## Portals and access

- Customers sign in with Google or a phone verification code. They choose one of four rooms, select a date and start time, pay its configured fixed price through Stripe Checkout, and only see their own bookings. The room/date/start-time slot becomes confirmed after Stripe verifies payment.
- Staff sign in with Google or an email/password account that an administrator has created and allowlisted. The UI checks staff membership, and database row-level security also blocks unlisted users from staff booking data.
- The Supabase anon/publishable key is public by design; row-level security protects the data. Never put a service-role key in `config.js` or other browser files.
- Staff cancellation submits a Stripe refund for paid bookings. Refund settlement time depends on the card issuer. Room prices are fixed per booking; this version does not calculate hourly pricing or prorated refunds.
