# Redis Super Cache examples

Runnable examples aligned with the step-by-step docs.

| Folder | Doc guide | Run |
|---|---|---|
| [express-basic](./express-basic/) | [Express guide](../docs/guides/express.md) | `REDIS_URL=redis://127.0.0.1:6379 npm start` |
| [nestjs-prisma](./nestjs-prisma/) | [NestJS guide](../docs/guides/nestjs.md) | `REDIS_URL=redis://127.0.0.1:6379 npm start` |

Start Redis first:

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

For a vanilla Node.js walkthrough (no Express), see [Node.js guide](../docs/guides/nodejs.md).
