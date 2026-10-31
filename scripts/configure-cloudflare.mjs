import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFail) {
      return (err.stdout || '') + '\n' + (err.stderr || '');
    }
    throw err;
  }
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    console.log('::notice title=Cloudflare Deploy Skipped::CLOUDFLARE_API_TOKEN secret is not set. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to GitHub Repository Secrets to deploy.');
    process.exit(0);
  }

  const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    console.error('Error: wrangler.toml not found at', wranglerPath);
    process.exit(1);
  }

  let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

  console.log('🚀 Configuring Cloudflare Workers & D1 Environment...');

  // 1. Resolve D1 Database ID
  let dbId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

  if (dbId && uuidRegex.test(dbId)) {
    console.log(`✓ Using explicit CLOUDFLARE_D1_DATABASE_ID from GitHub Secrets: ${dbId}`);
  } else {
    console.log('🔍 Querying Cloudflare for D1 database "pohumusic-db"...');
    // Try listing existing databases first
    const listOut = run('npx wrangler d1 list', true);
    let match = null;

    // Try finding pohumusic-db in list
    const lines = listOut.split('\n');
    for (const line of lines) {
      if (line.includes('pohumusic-db')) {
        const lineUuid = line.match(uuidRegex);
        if (lineUuid) {
          match = lineUuid[0];
          break;
        }
      }
    }

    if (!match) {
      // Try JSON format
      const jsonOut = run('npx wrangler d1 list --json', true);
      try {
        const parsed = JSON.parse(jsonOut);
        if (Array.isArray(parsed)) {
          const found = parsed.find(item => item.name === 'pohumusic-db' || item.database_name === 'pohumusic-db');
          if (found && (found.uuid || found.database_id)) {
            match = found.uuid || found.database_id;
          }
        }
      } catch {}
    }

    if (!match) {
      console.log('Creating D1 database "pohumusic-db"...');
      const createOut = run('npx wrangler d1 create pohumusic-db', true);
      const createdUuid = createOut.match(uuidRegex);
      if (createdUuid) {
        match = createdUuid[0];
      }
    }

    if (match) {
      dbId = match;
      console.log(`✓ Resolved D1 database_id: ${dbId}`);
    } else {
      console.error('\n❌ Could not automatically provision or find D1 database "pohumusic-db".');
      console.error('Cloudflare requires a real D1 database. To fix:');
      console.error('1. Open Cloudflare Dashboard -> Storage & Databases -> D1 -> Create database "pohumusic-db".');
      console.error('2. Copy the Database ID (UUID) and add it to GitHub Secrets as: CLOUDFLARE_D1_DATABASE_ID.\n');
      process.exit(1);
    }
  }

  // Inject D1 database_id into wrangler.toml
  wranglerContent = wranglerContent.replace(
    /database_id\s*=\s*"[^"]*"/,
    `database_id = "${dbId}"`
  );

  // 2. Resolve KV Namespace
  console.log('🔍 Checking Cloudflare KV namespace...');
  let kvId = null;
  const kvHexRegex = /[a-f0-9]{32}/i;

  const kvListOut = run('npx wrangler kv namespace list', true);
  try {
    const parsedKv = JSON.parse(kvListOut);
    if (Array.isArray(parsedKv)) {
      const foundKv = parsedKv.find(k => k.title?.includes('KV') || k.title?.includes('pohumusic'));
      if (foundKv && foundKv.id) {
        kvId = foundKv.id;
      }
    }
  } catch {}

  if (!kvId) {
    const createKvOut = run('npx wrangler kv namespace create KV', true);
    const kvMatch = createKvOut.match(kvHexRegex);
    if (kvMatch) {
      kvId = kvMatch[0];
    }
  }

  if (kvId) {
    console.log(`✓ Resolved KV Namespace ID: ${kvId}`);
    wranglerContent = wranglerContent
      .replace(/id\s*=\s*"pohumusic_kv_namespace_id"/, `id = "${kvId}"`)
      .replace(/preview_id\s*=\s*"pohumusic_kv_preview_id"/, `preview_id = "${kvId}"`);
  }

  // Save updated wrangler.toml
  fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
  console.log('✓ Updated wrangler.toml successfully.');

  // 3. Apply D1 Migrations
  console.log('⚡ Applying D1 migrations to remote database...');
  try {
    const migOut = run('npx wrangler d1 migrations apply pohumusic-db --remote');
    console.log(migOut);
  } catch (migErr) {
    console.warn('Warning during migrations:', migErr.message);
  }

  // 4. Deploy Worker
  console.log('🚀 Deploying Cloudflare Worker with Static Assets...');
  const deployOut = run('npx wrangler deploy');
  console.log(deployOut);
  console.log('🎉 Cloudflare Worker deployed successfully!');
}

main().catch(err => {
  console.error('Fatal deployment error:', err);
  process.exit(1);
});
