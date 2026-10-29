# Account, Sign-in, and Input Validation

## Components

- **Interface:** `web/pages/login/root.html`, `web/pages/login/register_info.html`, `web/auth.js`, and `web/main.js`.
- **HTTP layer:** `/login`, `/register`, `/register_info`, `/register_checkup`, and protected pages in `server.py`.
- **Validation:** `input_validator.py` contains `DeterministischerEndlicherAutomat`.
- **Identity and persistence:** `SessionMiddleware` in `server.py` and SQLite functions in `data/user/db_interaction.py`.

## Flow

1. The browser sends sign-in or registration data as JSON to FastAPI.
2. `DeterministischerEndlicherAutomat.is_valid_email` checks email addresses using explicit DFA states (`start`, local part, `@`, domain, dot, and a 2–3 letter TLD). `match`/`case` selects state transitions. The class also contains general helper checks for required fields and lengths; these helpers are not separate DFA automata.
3. `server.py` checks field limits and password length, and applies a per-process rate-limit queue to sign-in and registration.
4. Password hashing and user creation happen in the database functions. After a successful sign-in, the username is stored in a signed session cookie.
5. Protected endpoints read the user from `request.session`; the browser does not keep a sign-in token in `localStorage`.

## Security and architecture limits

- The session is signed with `SessionMiddlewareSecretKey`; `SESSION_HTTPS_ONLY` controls the Secure attribute.
- Mutating requests with an `Origin` or `Referer` header are checked against the same host by `same_origin_for_mutations`.
- Rate limits are held in process memory and are not shared between multiple Uvicorn workers.
- The DFA is a deliberately simple syntax check. It does not verify that a domain exists or that an address can receive mail.
- Database access and email uniqueness rules are implemented in `data/user/db_interaction.py`, not in the DFA class.
