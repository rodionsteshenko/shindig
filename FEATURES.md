# Shindig — Feature Roadmap

## v1.0 — MVP (Ship It)

### Event Creation
- [ ] Create event: name, date, time, end time
- [ ] Location: address + Google Maps link
- [ ] Description (rich text)
- [ ] Cover image upload (or pick from presets)
- [ ] Event URL: shindig.app/e/{slug}
- [ ] Private vs public toggle

### Guest Management
- [ ] Add guests by email
- [ ] Add guests by phone number
- [ ] Import from contacts (CSV upload)
- [ ] Guest list visible to host only (by default)
- [ ] Allow guests to add plus-ones (configurable)

### Invitations
- [ ] Send email invitations via Resend
- [ ] Beautiful email template (not plain text)
- [ ] Unique RSVP link per guest (no login required)
- [ ] "Add to Calendar" button (.ics file)

### RSVP Flow
- [ ] RSVP page: Going / Maybe / Can't Make It
- [ ] Plus-one: name + count
- [ ] Dietary restrictions: dropdown (vegetarian, vegan, gluten-free, nut allergy, halal, kosher, none) + free text
- [ ] Gift: show/hide registry link, "no gifts please" option
- [ ] Optional message to host
- [ ] Change RSVP anytime before event

### Host Dashboard
- [ ] Live guest count: going / maybe / declined / no response
- [ ] Guest list with RSVP status + details
- [ ] Send reminder to non-responders (one click)
- [ ] Export guest list as CSV

### Feature Request System
- [ ] "💡 Suggest a feature" button on every page
- [ ] Public feature board: title + description + upvotes
- [ ] Users can upvote existing suggestions
- [ ] Status labels: Suggested → Planned → Building → Live
- [ ] Notification when your suggestion ships

### Landing Page
- [ ] Hero: "Event invites that don't suck"
- [ ] Demo event you can interact with
- [ ] Pricing section
- [ ] Sign up / Log in (Supabase auth: Google + email magic link)

---

## v1.5 — Post-Launch Quick Wins

### SMS
- [ ] Send SMS invitations via Twilio
- [ ] SMS reminders (24h before, day-of)
- [ ] Two-way: guest can RSVP by replying to text

### Reminders
- [ ] Auto email reminder: 1 week before
- [ ] Auto email reminder: 1 day before
- [ ] Custom reminder schedule

### Themes
- [ ] 5-10 event themes (birthday, dinner party, wedding, baby shower, casual hangout, holiday party, corporate)
- [ ] Color customization
- [ ] Custom fonts (2-3 options)

### Invitation View Tracking
- [ ] Track when each guest opens their invitation email (via Resend webhooks)
- [ ] Show "Viewed" / "Not viewed" status on host dashboard guest list
- [ ] Help hosts identify who to nudge (viewed but didn't RSVP vs. never opened)

### Event Polls
- [ ] Host creates a poll (e.g. "Which date works?" or "What should we eat?")
- [ ] Guests vote from the event page or RSVP page
- [ ] Results visible to host (optionally to all guests)
- [ ] Multiple poll types: single choice, multi-select, free text

### Social
- [ ] Share event link via copy/paste
- [ ] Open Graph preview (looks good when shared on iMessage, WhatsApp, Slack)
- [ ] QR code for event page

---

## v2.0 — Growth Features

### Collaboration
- [ ] Co-hosts: invite others to manage the event
- [ ] Delegated tasks: assign "bring plates" to specific guests

### Potluck / Signups
- [ ] Signup slots: "bring a side dish", "bring drinks"
- [ ] Guests claim slots, visible to all
- [ ] Prevent duplicates

### Event Check-in
- [ ] Host can check in guests at the door (mobile-friendly UI)
- [ ] Real-time arrival count: checked in / expected / no-show
- [ ] QR code per guest for fast check-in (scan to mark arrived)

### After the Event
- [ ] Photo sharing: guests upload photos to a shared album
- [ ] Thank you message (bulk send)
- [ ] Event recap page
- [ ] Post-event reviews: guests leave ratings and feedback
- [ ] Review summary visible to host, optionally public for recurring events

### Recurring Events
- [ ] Repeat: weekly, monthly, custom
- [ ] Carry over guest list
- [ ] "Same time next month" one-click

### Advanced Guest Management
- [ ] Age ranges / kid-friendly toggle
- [ ] Table assignments (for seated events)
- [ ] Guest tags / groups
- [ ] Waitlist (when event is full)

### Public Event Discovery
- [ ] Browsable directory of public events at /explore
- [ ] Filter by location, date, category
- [ ] Search by keyword
- [ ] Category tags on events (dinner, party, sports, meetup, workshop, etc.)
- [ ] "Discover events near you" on landing page

### Integrations
- [ ] Google Calendar sync
- [ ] Apple Calendar sync
- [ ] Venmo/Zelle request for group payments (splitting costs)

---

## v3.0 — Premium / Monetization

### Pricing Model
- **Free:** 3 events/month, email only, 30 guests/event
- **Pro ($5/mo):** Unlimited events, SMS, 200 guests, custom branding, remove footer
- **Event Pass ($2 one-time):** One premium event (for infrequent users)

### Guest Contributions
- [ ] Embedded PayPal/Venmo collection on event page
- [ ] Use cases: group gifts, "chip in for the venue", donations
- [ ] Host sets optional goal amount
- [ ] Contributors visible to host, optionally to guests

### Scheduled Sending
- [ ] Schedule invitations to send at a future date/time
- [ ] "Save the date" followed by full invitation later
- [ ] Timezone-aware scheduling

### Ticketed Events
- [ ] Sell tickets via Stripe
- [ ] Early bird pricing with configurable end dates
- [ ] Promo codes for discounts
- [ ] Capacity limits tied to ticket sales

### Premium Features
- [ ] Custom domain (yourwedding.shindig.app)
- [ ] Remove "Powered by Shindig" footer
- [ ] Priority feature requests
- [ ] Analytics: open rates, click rates, response times
- [ ] Custom email sender name
- [ ] White-label for event planners

---

## Architecture Notes

### Database Schema (Supabase/Postgres)

```
users
  id, email, name, avatar_url, created_at

events
  id, host_id (FK users), title, description, location, 
  cover_image_url, start_time, end_time, timezone,
  slug (unique), is_public, allow_plus_ones, 
  show_gift_registry, gift_registry_url, gift_message,
  theme, created_at

guests
  id, event_id (FK events), name, email, phone,
  rsvp_status (pending/going/maybe/declined),
  plus_one_count, plus_one_names,
  dietary_restrictions, dietary_notes,
  message_to_host, rsvp_token (unique),
  invited_at, responded_at

feature_requests
  id, user_id (FK users), title, description,
  status (suggested/planned/building/live),
  upvotes, created_at

feature_votes
  id, feature_id (FK feature_requests), user_id (FK users)
```

### API Routes

```
POST   /api/events              — create event
GET    /api/events/:slug        — get event (public)
PUT    /api/events/:id          — update event (host only)
DELETE /api/events/:id          — delete event (host only)

POST   /api/events/:id/guests   — add guests
GET    /api/events/:id/guests   — list guests (host only)
POST   /api/events/:id/invite   — send invitations

POST   /api/rsvp/:token         — submit RSVP (no auth needed)
GET    /api/rsvp/:token         — get RSVP page data

POST   /api/features            — submit feature request
GET    /api/features            — list feature requests
POST   /api/features/:id/vote   — upvote

POST   /api/auth/signup         — register
POST   /api/auth/login          — magic link / Google OAuth
```

### Project Structure

```
shindig/
├── README.md
├── FEATURES.md
├── package.json
├── vercel.json
├── .env.local.example
├── src/
│   ├── app/                    # Pages
│   │   ├── page.tsx            # Landing page
│   │   ├── create/page.tsx     # Create event
│   │   ├── e/[slug]/page.tsx   # Event page (public)
│   │   ├── dashboard/page.tsx  # Host dashboard
│   │   ├── rsvp/[token]/page.tsx # RSVP flow
│   │   └── features/page.tsx   # Feature request board
│   ├── components/
│   │   ├── EventCard.tsx
│   │   ├── RSVPForm.tsx
│   │   ├── GuestList.tsx
│   │   ├── InviteForm.tsx
│   │   └── FeatureBoard.tsx
│   ├── lib/
│   │   ├── supabase.ts         # DB client
│   │   ├── resend.ts           # Email
│   │   ├── twilio.ts           # SMS (v1.5)
│   │   └── stripe.ts           # Payments (v3)
│   └── api/                    # Serverless functions
├── public/
│   └── themes/                 # Event theme assets
└── supabase/
    └── migrations/             # DB migrations
```
