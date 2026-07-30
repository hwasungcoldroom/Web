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
employment.html       Employment  (placeholder — no openings listed yet)
contact.html          Contact

styles.css            ALL styling for every page
script.js             ALL behaviour for every page
assets/               Images, shared and browser-cached
sitemap.xml           For Google
robots.txt            For crawlers
```

## Where to make changes

| You want to change… | Edit |
|---|---|
| Text or content on one page | that page's `.html` file |
| Colours, spacing, fonts, layout | `styles.css` |
| Menu, popups, snow, gauge, form | `script.js` |
| Logo or promo image | replace the file in `assets/` |
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
- **The booking form has no backend.** It validates the fields and shows the
  success message, but nothing is sent anywhere and no one is notified. See
  `BACKEND INTEGRATION POINT` in `script.js` for where to plug in an endpoint.
- **Images are shared files, not embedded.** They are downloaded once and cached
  for every subsequent page, which is why pages are ~10–25 KB instead of ~800 KB.
- The temperature gauge and the snowfall both respect
  `prefers-reduced-motion`, so they hold still for visitors who ask for that.

## Previous version

This replaced a single-file version where every section lived inside one
`index.html` behind a `#hash` router, with all CSS and JS inline. That is why
editing separate `services.html` / `about.html` files used to have no effect —
the site never loaded them. Each page is now a real file at a real URL, so
editing it does what you would expect.
