# Getting Started

## 1. Configure Environment Variables

Create a `.env` file in the project root and add your PostgreSQL configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=paper
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Start the Development Server

```bash
npm run dev
```
## 4. Start using PaperFlow

Visit http://localhost:3000/

# Local Deployment Using PM2
1. `pm2 delete all`
2. `pm2 start "npx tsx server.ts" --name paperflow`
3. `pm2 save`

Helpful commands:
- `pm2 logs`
- `pm2 list`