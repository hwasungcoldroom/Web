# Hwasung Refrigeration — Website

A plain HTML/CSS/JS site. No build step, no framework, no dependencies. Upload the
contents of this folder to your host and it works.

## Files

```
index.html            Home
partners.html         Partners
about.html            About
services.html         Services
why-choose-us.html    Why Choose Us
faq.html              FAQ
employment.html       Employment  (job cards + application form)
contact.html          Contact

styles.css            ALL styling for every page
script.js             ALL behaviour for every page
api/apply.js          Emails job applications (with CV attached)
api/booking.js        Emails Book Now callback requests
SETUP-EMAIL.md        How to configure it (read this first)
logo.png              Header logo
logo-large.png        Large logo on the About page
promo.jpg             Special Promo artwork
snow-border.jpg       Decorative page edges
hero-bg.jpg           Background texture
favicon.png           Browser tab icon
sitemap.xml           For Google
robots.txt            For crawlers
```

**Everything sits in one flat folder — there are no subfolders.** That is
deliberate: image paths are plain filenames like `logo.png`, so uploading is
just "select all, upload" with nothing to miss.

## Where to make changes

| You want to change… | Edit |
|---|---|
| Text or content on one page | that page's `.html` file |
| Colours, spacing, fonts, layout | `styles.css` |
| Menu, popups, snow, gauge, form | `script.js` |
| Logo or promo image | replace the `.png` / `.jpg` file |
| Header or footer | see the warning below |

### The header and footer are duplicated

Because there is no build step, the `<header>` and `<footer>` blocks are copied
into all eight HTML files. **If you change one, change all eight**, or the nav
will disagree between pages.

Things that live in the header/footer: the logo, the "Building Management"
tagline, the nav links, the Book Now button, footer contact details, and the
opening hours.

Adding a new page means: copy an existing page, replace the `<main>` contents,
update `<title>`/`<meta description>`/`<link rel="canonical">`, then add the new
nav link to all eight files and to `sitemap.xml`.

### The active nav item

Each page marks its own nav link with `aria-current="page"`, which is what draws
the underline. When you copy a page, move that attribute to the correct link.

## Notes

- **The promo + booking popup pair only appears on the home page.** That is driven
  by `#welcome-modal`, which exists only in `index.html`. The Book Now button in
  the header opens just the booking form and works on every page.
- **The Employment page** lists four roles. To mark one as filled, give its card
  `class="job-card job-card--filled"`, swap the status pill to
  `job-status--filled`, and replace the button with
  `<button class="btn btn-block btn-filled" disabled>Position Full</button>`.
  Removing the `js-apply` class is what stops it opening the form. To add a role,
  copy an open card and set `data-role` plus `data-variant`
  (`experienced` / `trainee` / `office`) on both the card and its button.
- **Neither form has a backend.** The application form does not upload the CV
  anywhere. It validates the fields and shows the
  success message, but nothing is sent anywhere and no one is notified. See
  `BACKEND INTEGRATION POINT` in `script.js` for where to plug in an endpoint.
- **Images are shared files, not embedded.** They are downloaded once and cached
  for every subsequent page, which is why pages are ~10–25 KB instead of ~800 KB.
  Keep them in the same folder as the HTML files.
- The temperature gauge and the snowfall both respect
  `prefers-reduced-motion`, so they hold still for visitors who ask for that.

## Previous version

This replaced a single-file version where every section lived inside one
`index.html` behind a `#hash` router, with all CSS and JS inline. That is why
editing separate `services.html` / `about.html` files used to have no effect —
the site never loaded them. Each page is now a real file at a real URL, so
editing it does what you would expect.
