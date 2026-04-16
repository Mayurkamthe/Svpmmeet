# SVPM Alumni Registration & Life Membership Platform

A full-stack alumni management platform for **SVPM College of Engineering, Malegaon Bk, Baramati**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | EJS (Server-Side Rendering) |
| Database | MongoDB + Mongoose |
| Auth | Firebase (Google OAuth + OTP) + JWT |
| Payments | Razorpay |
| Styling | Tailwind CSS |
| Email | Nodemailer (Gmail SMTP) |
| PDF | PDFKit |
| Export | SheetJS (XLSX) |

---

## Features

### Authentication
- Email/Password login with bcrypt hashing
- Firebase Google OAuth (one-click sign-in)
- Firebase Phone OTP login
- JWT session management
- Forgot/Reset password via email token

### Alumni Portal
- Registration with unique Alumni ID (SVPM-YYYY-XXXX)
- Profile creation & editing with photo upload
- Apply for Life Membership (Razorpay payment)
- Download Membership Certificate (PDF)
- Browse Alumni Directory (search/filter)
- View payment history & download receipts
- Register for events
- View announcements

### Admin Panel
- Dashboard with live stats (alumni, revenue, members)
- Approve / reject alumni registrations
- Manage membership applications
- View & manage all payments
- Export alumni data to Excel (.xlsx)
- Create & manage events
- Post announcements

### Payment & Receipts
- Razorpay integration (UPI, Card, Net Banking, Wallet)
- Auto receipt generation (PDF)
- Email notification on payment success

### Email Notifications
- Registration confirmation
- Payment success receipt
- Membership approval
- Password reset link

---

## Project Structure

```
svpm-alumni/
├── app.js                    # Express entry point
├── .env.example              # Environment variables template
├── config/
│   ├── firebase.js           # Firebase Admin SDK
│   ├── email.js              # Nodemailer + templates
│   └── seeder.js             # Admin account seeder
├── models/
│   ├── User.js               # Alumni/Admin schema
│   ├── Payment.js            # Payment schema
│   ├── Event.js              # Event + Registration schema
│   └── Announcement.js       # Announcement schema
├── controllers/
│   ├── authController.js
│   ├── alumniController.js
│   ├── adminController.js
│   └── eventsController.js
├── middleware/
│   └── auth.js               # JWT + role guards
├── routes/
│   ├── index.js, auth.js, alumni.js
│   ├── admin.js, events.js
│   ├── payments.js, api.js
├── views/
│   ├── index.ejs             # Landing page
│   ├── auth/                 # Login, Register, Forgot/Reset
│   ├── alumni/               # Dashboard, Profile, Membership, Directory
│   ├── admin/                # Dashboard, Alumni, Memberships, Payments, Events
│   ├── events/               # List, Detail
│   └── partials/             # Navbar, Sidebars, Footer
└── public/
    ├── css/style.css
    ├── js/app.js
    └── images/
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Mayurkamthe/Svpmmeet.git
cd Svpmmeet
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Required `.env` values

```env
MONGODB_URI=mongodb://localhost:27017/svpm_alumni
JWT_SECRET=your_jwt_secret
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_secret
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
ADMIN_EMAIL=admin@svpmcoe.edu.in
ADMIN_PASSWORD=Admin@SVPM2024
```

### 4. Run

```bash
# Development
npm run dev

# Production
npm start
```

App runs at: **http://localhost:3000**

---

## Default Admin Login

| Field | Value |
|---|---|
| Email | `admin@svpmcoe.edu.in` |
| Password | `Admin@SVPM2024` |

> Change immediately after first login!

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project → Enable **Authentication**
3. Enable **Google** and **Phone** sign-in methods
4. Go to **Project Settings → Service Accounts** → Generate new private key
5. Copy values to `.env`
6. Add your domain to **Authorized Domains**

---

## Razorpay Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Get **Key ID** and **Key Secret** from Dashboard → Settings → API Keys
3. Add to `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
4. Set `MEMBERSHIP_AMOUNT` (in INR, default: 1000)

---

## Alumni ID Format

```
SVPM-{PASSOUT_YEAR}-{SEQUENCE}
Example: SVPM-2024-0001
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/` | Landing page |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/register` | Alumni registration |
| POST | `/auth/firebase` | Firebase OAuth/OTP login |
| GET | `/alumni/dashboard` | Alumni dashboard |
| GET | `/alumni/profile` | View profile |
| POST | `/alumni/profile/edit` | Update profile |
| GET | `/alumni/membership` | Membership page |
| POST | `/alumni/membership/apply` | Create Razorpay order |
| POST | `/alumni/membership/verify-payment` | Verify payment |
| GET | `/alumni/certificate` | Download PDF certificate |
| GET | `/alumni/directory` | Browse alumni |
| GET | `/alumni/payments` | Payment history |
| GET | `/payments/receipt/:id` | Download PDF receipt |
| GET | `/admin/dashboard` | Admin dashboard |
| GET | `/admin/alumni` | Manage alumni |
| POST | `/admin/alumni/:id/approve` | Approve alumni |
| GET | `/admin/memberships` | Membership requests |
| POST | `/admin/memberships/:id/approve` | Approve membership |
| GET | `/admin/payments` | All payments |
| GET | `/admin/export/alumni` | Export Excel |
| GET | `/admin/events` | Manage events |
| POST | `/admin/events` | Create event |
| GET | `/admin/announcements` | Manage announcements |
| POST | `/admin/announcements` | Post announcement |
| GET | `/events` | Events list |
| GET | `/events/:id` | Event detail |
| POST | `/events/:id/register` | Register for event |

---

## College Details

**SVPM College of Engineering**  
Malegaon Bk, Baramati, Pune - 413115  
Maharashtra, India

---

## License

MIT License — SVPM Alumni Association © 2024
