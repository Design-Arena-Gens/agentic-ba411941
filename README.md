# AegisPay Smart Routing Hub

AegisPay is a demo payment orchestration console that showcases multi-merchant support, smart processor routing, and conflict resolution workflows. It is built with Next.js 14, the App Router, and Tailwind CSS.

## Features

- **Smart routing simulator** – run ad-hoc payment attempts, evaluate processor selection, and inspect routing outcomes in real time.
- **Multi-processor topology** – explore detailed processor health data, availability, and specialization traits within the routing mesh.
- **Conflict resolution desk** – manage escalated transactions, review suggested fallbacks, and close incidents with a single action.
- **Operational lens** – monitor live metrics across processed volume, success rates, and merchant coverage.

## Local Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) to access the control surface.

## Quality Checks

```bash
npm run lint
npm run build
```

## Deployment

Deploy to Vercel with:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-ba411941
```

Once DNS propagation finishes, verify the deployment:

```bash
curl https://agentic-ba411941.vercel.app
```
