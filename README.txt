ESCAPE MANSION — THE MYSTERY HOUSE
CUSTOMER + STAFF PORTALS WITH ROOM CHECKOUT

customer.html — customer sign-in and booking portal (Google or phone OTP)
employee.html — staff-only booking management portal
index.html — redirects the domain root to the customer portal
supabase.sql — database tables, four rooms, prices, and row-level access rules
api/create-checkout-session.js — server-side room reservation and Stripe Checkout
api/stripe-webhook.js — payment confirmation and expired checkout release
api/cancel-booking.js — staff-only cancellation and refund handling
package.json — Vercel serverless dependencies
config.js — Supabase project URL and browser-safe anon/publishable key

SETUP BEFORE DEPLOYING
1. Create a Supabase project and run supabase.sql in its SQL Editor.
2. Put the project URL and anon/publishable key in config.js. Never use the service-role key in the website.
3. Set a positive price in cents and currency on each room in Supabase. New rooms start at $0 and checkout won't start until you set a price.
4. In Supabase Authentication, enable Google OAuth and phone sign-in/SMS. Add the deployed domain to allowed redirect URLs. Configure an SMS provider for phone OTP delivery.
5. Create staff accounts in Supabase Auth, then add each staff email to public.staff_members in the SQL Editor. Only allowlisted staff can read or edit all bookings; database row-level security enforces this.
6. Configure Stripe Checkout and the webhook. Set the Supabase URL, anon key, service-role key, Stripe secret key, and Stripe webhook signing secret as Vercel environment variables. Keep secret keys out of GitHub.
7. Deploy the project to Vercel (Other preset, no build command, output directory `.`).

See DEPLOY.md for detailed GitHub, Vercel, Supabase, Stripe, and auth-provider setup steps. Google OAuth requires Google Cloud OAuth credentials configured in Supabase. Phone OTP requires an SMS provider and may incur charges. Prices are fixed per booking; duration-based rates are not included yet.
