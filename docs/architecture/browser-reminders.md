# Browser Reminders

## Browser flow

`web/reminders.js` is loaded on the Overview, Recommendations, Calendar, and AI assistant pages. The script adds a button to the user bar. The browser asks for notification permission only after the user clicks; Python and the database are not involved in the timer.

After permission is granted, the browser stores the start time, next reminder time, and expiry time in `localStorage`. A JavaScript timer checks every 30 seconds whether a reminder is due. Reminders appear every two hours, and activation ends after ten hours. Local storage preserves the state while navigating between supported Rebuild pages.

## Limitations

- A reminder works only while a Rebuild page stays open and the browser supports the Notification API.
- No timer runs and no push notification is delivered while the browser or page is closed.
- A secure browser context (HTTPS or localhost) and the user's permission are required.
- The active reminder is stored locally in the browser, not per user in Python or SQLite.
