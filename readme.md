# Backend Ledger

A double-entry ledger and money-transfer backend built with Node.js, Express, and MongoDB. It exposes REST APIs for user authentication, account management, and account-to-account transactions, with balances always derived from an immutable ledger rather than stored as a mutable field.

## How it works

Instead of storing a `balance` field on each account, every transaction writes two immutable **ledger entries** — a `DEBIT` on the sender's account and a `CREDIT` on the receiver's — and an account's balance is computed on demand by aggregating its ledger entries (`totalCredit - totalDebit`). This is the standard double-entry bookkeeping pattern, and it means the ledger collection is an append-only audit trail: entries cannot be updated or deleted (enforced at the schema level via Mongoose pre-hooks).

Each transfer also:
- Requires a client-supplied **idempotency key**, so retried requests don't create duplicate transfers.
- Runs inside a **MongoDB session/transaction** so the transaction record and both ledger entries are written atomically.
- Checks that both accounts are `ACTIVE` and that the sender has sufficient balance before moving funds.
- Moves through a `PENDING -> COMPLETED` (or `FAILED`/`REVERSED`) status lifecycle.

## Features

- **Auth** — registration, login, and logout using JWT (cookie or `Authorization: Bearer` header), password hashing with bcrypt, and a token blacklist collection for logout/invalidations (auto-expires after 3 days via a MongoDB TTL index).
- **Accounts** — create an account, list a user's accounts, and fetch a computed balance for a specific account. Every account is scoped to the authenticated user.
- **Transactions** — transfer funds between two accounts, and a separate system-only endpoint for seeding initial funds into an account.
- **Ledger** — an append-only, immutable collection of debit/credit entries that account balances are derived from.
- **Email notifications** — registration and transaction emails sent via Nodemailer (Gmail OAuth2).

## Tech stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose
- **Auth:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs` for password hashing
- **Email:** Nodemailer (Gmail, OAuth2)
- **Dev tooling:** `nodemon`, `dotenv`

## Project structure

```
backend-ledger/
├── server.js                 # Entry point — loads env, connects DB, starts server
├── src/
│   ├── app.js                 # Express app setup and route mounting
│   ├── config/
│   │   └── db.js               # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── account.controller.js
│   │   └── transaction.controller.js
│   ├── middleware/
│   │   └── auth.middleware.js  # JWT auth + system-user auth guards
│   ├── models/
│   │   ├── user.model.js
│   │   ├── account.model.js
│   │   ├── transaction.model.js
│   │   ├── ledger.model.js     # Immutable double-entry ledger
│   │   └── blackList.model.js  # Blacklisted (logged-out) tokens
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── account.routes.js
│   │   └── transaction.routes.js
│   └── services/
│       └── email.service.js
└── package.json
```

## API reference

All protected routes expect a JWT either as a `token` cookie or an `Authorization: Bearer <token>` header.

### Auth — `/api/auth`

| Method | Endpoint    | Description                          | Auth |
|--------|-------------|---------------------------------------|------|
| POST   | `/register` | Create a new user, returns a JWT      | No   |
| POST   | `/login`    | Log in with email/password            | No   |
| POST   | `/logout`   | Blacklist the current token           | No   |

### Accounts — `/api/accounts`

| Method | Endpoint             | Description                          | Auth |
|--------|-----------------------|---------------------------------------|------|
| POST   | `/`                    | Create an account for the current user | Yes |
| GET    | `/`                    | List the current user's accounts       | Yes |
| GET    | `/balance/:accountId`  | Get the computed balance of an account | Yes |

### Transactions — `/api/transactions`

| Method | Endpoint               | Description                                       | Auth              |
|--------|-------------------------|----------------------------------------------------|--------------------|
| POST   | `/`                      | Transfer funds between two accounts (idempotent)    | Yes                |
| POST   | `/system/initial-funds`  | Seed initial funds into an account                  | Yes (system user)  |

## Getting started

### Prerequisites

- Node.js
- A MongoDB instance (local or Atlas)
- A Gmail account with an OAuth2 client (only required if you want email notifications to work)

### Installation

```bash
git clone https://github.com/<your-username>/backend-ledger.git
cd backend-ledger
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

# Gmail OAuth2, used for sending registration/transaction emails
EMAIL_USER=your_gmail_address
CLIENT_ID=your_google_oauth_client_id
CLIENT_SECRET=your_google_oauth_client_secret
REFRESH_TOKEN=your_google_oauth_refresh_token
```

### Run

```bash
# development (auto-restart with nodemon)
npm run dev

# production
npm start
```

The server starts on `http://localhost:3000`.

## License

ISC