# One-click Travel Plannar

A responsive travel planner starter built with Vite and vanilla JavaScript. Select one of four destinations, a departure date, a trip length, and a pace to generate a sample itinerary.

## Development

Requires Node.js 22 or newer (Node 24 is specified in `.nvmrc`).

```sh
npm ci
npm run dev
```

## Checks and build

```sh
npm test
npm run build
npm run preview
```

## Working features

- Choose Kyoto, Lisbon, Bali, or Paris.
- Generate a 1–7 day itinerary with three travel pace options.
- Surprise me selects another destination.
- Save, reopen, and remove trips using browser local storage.
- Download an itinerary as a text file.
- Responsive keyboard-accessible controls and status messages.

These are static sample itineraries. There are no AI calls, live prices, reservations, or availability checks. Trips are saved only on the current browser. No API keys, environment variables, or database are required.

## Deployment

Import this repository into Vercel using the Vite framework preset. The build command is `npm run build` and output directory is `dist`; both are included in `vercel.json`. Connect `main` as the production branch for automatic deployments.
