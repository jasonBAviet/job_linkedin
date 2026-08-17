/**
 * Chẩn đoán hạ tầng trước khi migrate.
 * Chạy: node scripts/db-doctor.mjs
 *
 * Chỉ ĐỌC, không tạo/sửa bất kỳ thứ gì trên server.
 */
import pg from "pg";
import { loadEnv } from "./lib/env.mjs";
import { openTunnel } from "./lib/tunnel.mjs";

const ok = (m) => console.log(`  [OK]   ${m}`);
const bad = (m) => console.log(`  [LOI]  ${m}`);
const info = (m) => console.log(`  ...    ${m}`);

async function main() {
  console.log("=== CHAN DOAN HA TANG DATABASE ===\n");

  console.log("1) Doc cau hinh .env");
  let env;
  try {
    env = loadEnv();
    ok(`SSH ${env.sshUser}@${env.sshHost}:${env.sshPort}`);
    ok(`Postgres (nhin tu server) ${env.remoteDbHost}:${env.remoteDbPort}`);
    ok(`DB dich: "${env.dbName}" | user: ${env.dbUser}`);
  } catch (e) {
    bad(e.message);
    process.exit(1);
  }

  console.log("\n2) Mo SSH tunnel");
  let tunnel;
  try {
    tunnel = await openTunnel(env, "doctor");
    ok(`Tunnel san sang: 127.0.0.1:${tunnel.localPort} -> ${env.remoteDbHost}:${env.remoteDbPort}`);
  } catch (e) {
    bad(`Khong mo duoc SSH tunnel: ${e.message}`);
    if (/authentication|All configured auth/i.test(e.message)) {
      info("Kiem tra lai SSH_USER / SSH_PASSWORD trong .env");
    }
    if (/ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH/i.test(e.message)) {
      info(`Khong toi duoc ${env.sshHost}:${env.sshPort} — kiem tra mang/firewall`);
    }
    process.exit(1);
  }

  const connect = async (database) => {
    const client = new pg.Client({
      host: "127.0.0.1",
      port: tunnel.localPort,
      database,
      user: env.dbUser,
      password: env.dbPassword,
      ssl: false,
      connectionTimeoutMillis: 15000,
      application_name: "job-hunter-doctor",
    });
    await client.connect();
    return client;
  };

  console.log(`\n3) Ket noi Postgres (database "${env.maintenanceDb}")`);
  let admin;
  try {
    admin = await connect(env.maintenanceDb);
    ok("Ket noi thanh cong");
  } catch (e) {
    bad(`Khong ket noi duoc: ${e.message}`);
    if (/ECONNREFUSED/i.test(e.message)) {
      info(`Postgres khong lang nghe tren ${env.remoteDbHost}:${env.remoteDbPort} (nhin tu server).`);
      info("SSH vao server va chay: ss -lntp | grep 5432");
    }
    if (/password authentication failed/i.test(e.message)) info("Sai DB_USER / DB_PASSWORD");
    if (/no pg_hba\.conf entry/i.test(e.message)) info("pg_hba.conf chan user nay tu 127.0.0.1");
    if (/database .* does not exist/i.test(e.message)) info(`Database "${env.maintenanceDb}" khong ton tai`);
    await tunnel.close();
    process.exit(1);
  }

  try {
    console.log("\n4) Thong tin may chu");
    const v = await admin.query("SELECT version() AS v, current_user AS u");
    ok(v.rows[0].v.split(",")[0]);
    ok(`Dang dang nhap voi user: ${v.rows[0].u}`);

    const num = await admin.query("SHOW server_version_num");
    const vnum = Number(num.rows[0].server_version_num);
    if (vnum >= 120000) ok(`server_version_num=${vnum} (>=12, ho tro generated column)`);
    else bad(`server_version_num=${vnum} (<12, KHONG ho tro GENERATED ALWAYS AS ... STORED)`);

    console.log("\n5) Quyen han");
    const r = await admin.query(
      "SELECT rolcreatedb, rolsuper FROM pg_roles WHERE rolname = current_user"
    );
    const role = r.rows[0] || {};
    if (role.rolsuper) ok("User la SUPERUSER");
    if (role.rolcreatedb) ok("User CO quyen CREATE DATABASE");
    else if (!role.rolsuper) bad("User KHONG co quyen CREATE DATABASE");

    console.log("\n6) Danh sach database");
    const dbs = await admin.query(
      "SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datistemplate = false ORDER BY datname"
    );
    dbs.rows.forEach((d) => info(`${d.datname}  (owner: ${d.owner})`));
    const exists = dbs.rows.some((d) => d.datname === env.dbName);
    if (exists) ok(`Database dich "${env.dbName}" DA TON TAI`);
    else info(`Database dich "${env.dbName}" chua ton tai — se tao o buoc migrate`);

    if (exists) {
      console.log(`\n7) Bang trong "${env.dbName}"`);
      await admin.end();
      admin = await connect(env.dbName);
      const t = await admin.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
      );
      if (t.rows.length === 0) info("(chua co bang nao)");
      else t.rows.forEach((x) => info(x.tablename));
    }

    console.log("\n=== KET LUAN: ha tang SAN SANG de migrate ===");
  } catch (e) {
    bad(`Loi khi truy van: ${e.message}`);
    process.exitCode = 1;
  } finally {
    try {
      await admin.end();
    } catch {}
    await tunnel.close();
  }
}

main().catch((e) => {
  console.error("Loi khong mong doi:", e);
  process.exit(1);
});
