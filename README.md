# Korin Task Management

Aplikasi manajemen task berbasis **Project** untuk tim internal Koperindo.
Admin (atau leader) membuat/mengatur anggota tim di dalam sebuah Project,
lalu tim bekerja lewat tampilan **List Tree** (To Do / In Progress / Done)
khusus Project itu, lengkap dengan subtask, Timeline mingguan, History
otomatis, dan Report ala WhatsApp.

Dibuat dengan: **Next.js 16 (App Router)** + **TypeScript** + **TailwindCSS v4**
+ **Prisma 7** + **PostgreSQL** + **Auth.js v5 (next-auth)**.

---

## 1. Model Akses: Role & Scope (BACA INI DULU)

Ini bagian paling penting untuk dipahami sebelum menyentuh kode apa pun,
karena hampir semua endpoint API menegakkan aturan ini.

Setiap `User` punya `role` GLOBAL — salah satu dari tiga:

| Role       | Bisa akses Project mana                                   | Bisa lihat/kelola task siapa saja                                  |
|------------|-------------------------------------------------------------|----------------------------------------------------------------------|
| **admin**  | SEMUA project (tanpa perlu didaftarkan sebagai anggota)     | SEMUA task, tanpa batas (all access)                                 |
| **leader** | Hanya project tempat dia terdaftar sebagai `ProjectMember`  | Task miliknya sendiri **+** task milik staff yang `leaderId`-nya = dia |
| **staff**  | Hanya project tempat dia terdaftar sebagai `ProjectMember`  | Hanya task miliknya sendiri (assignee = dirinya)                     |

Poin krusial: **leader TIDAK bisa melihat staff milik leader lain**, meskipun
sama-sama jadi anggota di project yang sama. Setiap staff selalu melekat ke
tepat satu leader lewat kolom `User.leaderId` (relasi ini GLOBAL, bukan
per-project).

**Siapa boleh membuat user baru:**
- Admin bisa membuat user dengan role apa saja. Kalau admin membuat staff
  tanpa menentukan `leaderId`, staff itu otomatis melekat ke admin itu
  sendiri — jadi admin juga bisa langsung membawahi staf sendiri, persis
  seperti leader.
- Leader hanya boleh membuat staff baru, dan staff itu otomatis melekat ke
  leader tersebut (dipaksa di server, field `leaderId` dari client diabaikan).
- Staff tidak bisa membuat/mengedit user sama sekali.

**Siapa boleh CRUD task:**
- Staff **bisa** membuat, mengedit, dan menghapus task-nya sendiri (bukan
  read-only) — tapi task yang dia buat SELALU otomatis ter-assign ke
  dirinya sendiri. Dropdown "Assign ke" di form task dikunci untuk staff.
- Leader bisa CRUD penuh di scope-nya (dirinya + staf miliknya).
- Admin bisa CRUD apa saja.

**Yang TIDAK ikut aturan scope di atas** — tetap admin-only seperti semula:
- Membuat / mengedit / menghapus **Project** itu sendiri (wadahnya, bukan
  task di dalamnya).

Semua logic scope ini terpusat di satu file: **`lib/auth-helpers.ts`**
(`getTaskScopeUserIds()`, `canAccessTask()`, `canAssignTo()`). Kalau mau
menambah aturan otorisasi baru, mulai dari situ, lalu terapkan di route API
yang relevan — jangan duplikasi logic manual di tiap route.

Domain email semua user **wajib** `@koperindo.id`, divalidasi di server saat
create/edit user (`app/api/users/route.ts` & `[id]/route.ts`).

---

## 2. Cara Menjalankan di Lokal

Kamu butuh database PostgreSQL yang jalan duluan. Cara paling cepat tanpa
install Postgres manual adalah pakai Docker:

```bash
docker run --name korin-task-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=korin_task_manager \
  -p 5432:5432 \
  -d postgres:16
```

Kalau tidak pakai Docker, install PostgreSQL secara lokal lalu buat database
kosong bernama `korin_task_manager`.

```bash
# 1. Buat file .env sendiri (tidak ada .env.example di repo saat ini —
#    kalau kamu yang membuatnya duluan, tolong commit .env.example juga
#    supaya kontributor berikutnya tidak perlu menebak-nebak isinya).
touch .env
```

Isi `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/korin_task_manager
AUTH_SECRET=tempel-hasil-openssl-di-sini
```

`AUTH_SECRET` dipakai Auth.js untuk menandatangani session JWT. Generate
secret acak dengan:
```bash
openssl rand -base64 33
```

```bash
# 2. Install semua dependency
# next-auth versi beta (v5) belum menyatakan dukungan resmi untuk Next.js 16
# di peer dependency-nya, jadi npm perlu dipaksa dengan --legacy-peer-deps.
# Ini aman dilakukan — next-auth v5 beta SUDAH kompatibel jalan di Next.js 16,
# cuma metadata peer-dependency-nya yang belum diperbarui.
npm install --legacy-peer-deps

# 3. Generate Prisma Client (membaca schema.prisma, bikin tipe TypeScript-nya
#    di lib/generated/prisma)
npx prisma generate

# 4. Buat tabel-tabel di database sesuai schema.prisma
npm run db:push

# 5. Isi database dengan data contoh (5 user, 1 project, 3 task)
npm run db:seed

# 6. Jalankan development server
npm run dev
```

Lalu buka **http://localhost:3000** — kamu akan diarahkan ke halaman login.

> ⚠️ **Kalau `npm run db:push` menolak dengan warning "There might be data
> loss ... values [member] on the enum GlobalRole will be removed"**,
> artinya database kamu masih punya user dari skema role LAMA (`admin` /
> `member`, sebelum revisi 3-role admin/leader/staff). Migrasikan dulu
> sebelum push — lihat bagian **"Migrasi dari skema role lama"** di bawah.

### Akun contoh (dari `db:seed`)

Semua akun memakai password yang sama: `password123`

| Email                    | Role (global) | Leader (kalau staff) | Peran di project "Internal Tools" |
|----------------------------|----------------|------------------------|--------------------------------------|
| itai@koperindo.id           | **admin**      | —                       | Project Manager                       |
| market@koperindo.id         | leader         | —                       | Leader Marketing                      |
| finance@koperindo.id        | leader         | —                       | Leader Finance                        |
| aryak@koperindo.id          | staff          | itai                    | Fullstack Developer                   |
| crysna@koperindo.id         | staff          | itai                    | Fullstack Developer                   |

Catatan: `market` dan `finance` sengaja belum punya staf sendiri di data
contoh ini (silakan tambahkan lewat halaman `/users` setelah login sebagai
salah satu dari mereka, atau lewat admin).

Login sebagai `itai@koperindo.id` untuk mencoba fitur admin (buat project,
kelola semua user & task). Login sebagai `market@koperindo.id` /
`finance@koperindo.id` untuk sudut pandang leader (scope terbatas ke
dirinya + staf sendiri). Login sebagai `aryak@koperindo.id` /
`crysna@koperindo.id` untuk sudut pandang staff (hanya lihat task
miliknya sendiri).

> Ganti password contoh ini sebelum dipakai sungguhan — lihat bagian
> "Menambah user baru" di bawah.

### Menambah user baru

Belum ada halaman registrasi mandiri (sengaja — supaya admin/leader yang
mengontrol siapa saja yang boleh punya akun). Untuk menambah user:

- **Lewat halaman `/users`**: login sebagai admin atau leader, buka menu
  "Anggota" di navbar, klik "+ Tambah Anggota" / "+ Tambah Staf". Leader
  hanya bisa menambah staff (otomatis melekat ke dirinya); admin bisa pilih
  role apa saja.
- **Lewat API langsung**: `POST /api/users` (lihat `app/api/users/route.ts`)
  — body: `{ name, email, password, role, leaderId? }`. Email wajib domain
  `@koperindo.id`.
- **Lewat seed**: edit `prisma/seed.ts` lalu jalankan ulang `npm run db:seed`
  (perhatian: script ini menghapus semua data lama dulu — jangan jalankan
  di production kalau sudah ada data penting).

### Database Browser (opsional, sangat membantu saat development)

```bash
npm run db:studio
```

Ini membuka GUI di browser untuk melihat & edit isi database secara visual.
Berguna untuk cek cepat isi kolom `role`/`leaderId` tanpa nulis query SQL.

### Migrasi dari skema role lama (`admin`/`member` → `admin`/`leader`/`staff`)

Kalau kamu meng-clone repo ini dan database-mu (lokal atau production) masih
berisi data dari SEBELUM revisi role 3-tingkat, `prisma db push` akan
menolak jalan karena Postgres tidak mengizinkan value enum (`member`)
dihapus selagi masih dipakai baris data. Migrasikan dulu manual:

```bash
# 1. Cek dulu siapa saja yang masih pakai role lama
psql "$DATABASE_URL" -c "SELECT id, name, email, role FROM \"User\" WHERE role = 'member';"

# 2. Tambahkan value enum baru TANPA menghapus yang lama dulu
psql "$DATABASE_URL" -c "ALTER TYPE \"GlobalRole\" ADD VALUE IF NOT EXISTS 'leader';"
psql "$DATABASE_URL" -c "ALTER TYPE \"GlobalRole\" ADD VALUE IF NOT EXISTS 'staff';"

# 3. Pindahkan user "member" ke role baru yang sesuai. Default aman: 'staff'
#    (paling ketat scope-nya). Kalau ada yang seharusnya jadi 'leader',
#    update satu-satu dengan WHERE email = '...' alih-alih blanket UPDATE.
psql "$DATABASE_URL" -c "UPDATE \"User\" SET role = 'staff' WHERE role = 'member';"

# 4. Baru jalankan db push seperti biasa — sekarang tidak akan ada warning lagi
npm run db:push
```

Ulangi 4 langkah ini untuk database production juga (arahkan `$DATABASE_URL`
ke connection string production) sebelum deploy kode baru — lihat bagian
Deploy di bawah untuk urutan lengkapnya.

---

## 3. Deploy ke Vercel dengan PostgreSQL

1. **Push project ini ke GitHub** (repo baru atau yang sudah ada), lalu di
   dashboard Vercel pilih **Add New → Project** dan import repo tersebut.

2. **Tambahkan database Postgres** — di dashboard project Vercel, buka tab
   **Storage → Create Database**, lalu pilih provider Postgres yang tersedia
   (misalnya **Prisma Postgres**, **Neon**, atau **Supabase**). Vercel
   otomatis membuatkan database dan menyuntikkan env var koneksinya ke
   project — **PERHATIAN**: nama env var yang disuntikkan Vercel BIASANYA
   BUKAN `DATABASE_URL` persis (contoh: `DB_PRISMA_DATABASE_URL`,
   `POSTGRES_URL`, dst, tergantung provider & integrasi). Ini sudah pernah
   jadi sumber bug produksi di project ini (lihat "Riwayat Masalah" di
   bawah) — jangan sampai terulang.

3. **Samakan nama env var.** Project ini membaca `DATABASE_URL` di
   `prisma.config.ts` dan `lib/prisma.ts`. Buka **Settings → Environment
   Variables** di project Vercel, tambahkan env var baru bernama PERSIS
   `DATABASE_URL` dengan value yang SAMA dengan connection string yang
   Vercel berikan (copy-paste, jangan ketik ulang manual).

4. **Tambahkan `AUTH_SECRET`** di **Settings → Environment Variables**,
   isinya hasil `openssl rand -base64 33` (generate yang BARU, jangan dipakai
   ulang dari lokal).

5. **Setting npm install**: karena next-auth beta belum menyatakan dukungan
   resmi Next.js 16 di peer dependency, tambahkan **Install Command** custom
   di **Settings → General → Build & Development Settings**:
   ```
   npm install --legacy-peer-deps
   ```

6. **Build command sudah otomatis menjalankan `prisma generate`** — lihat
   script `build` di `package.json` (`prisma generate && next build`), jadi
   tidak perlu setting tambahan untuk ini.

7. **Push schema ke database production SEBELUM deploy** (dan setiap kali
   `prisma/schema.prisma` berubah — lihat checklist lengkap di bawah).
   **Project ini TIDAK punya automasi CI/CD untuk sinkronisasi schema** —
   tidak ada GitHub Action yang otomatis menjalankan `db push` ke production.
   Setiap perubahan schema harus di-push MANUAL dari komputer lokal:
   ```bash
   DATABASE_URL="<connection string production>" npx prisma db push
   ```
   Kalau ada warning data loss (biasanya karena enum value lama masih
   dipakai), JANGAN langsung jawab "yes" — cek dulu datanya, lihat bagian
   "Migrasi dari skema role lama" di atas untuk contoh penanganannya.

   Setelah schema table sudah ada, buat MINIMAL satu user admin — lewat
   `npm run db:seed` yang diarahkan ke production (hati-hati, ini
   menghapus semua data dulu — hanya aman untuk deploy PERTAMA KALI ke
   database kosong), atau insert manual lewat `prisma studio` dengan
   password yang sudah di-hash bcrypt.

8. **Deploy.** Klik Deploy di Vercel (atau push ke branch yang terhubung).
   Vercel otomatis re-deploy setiap ada push ke branch production.

> ⚠️ **Kalau curiga Vercel memakai versi Prisma Client yang sudah usang**
> (misalnya error kolom "not exist" padahal kolomnya sudah ada di database),
> redeploy dengan opsi **"Use existing Build Cache" dimatikan**.

> Catatan: jangan commit file `.env` ke git (sudah di-ignore lewat
> `.gitignore`). Semua secret (`DATABASE_URL`, `AUTH_SECRET`) cukup
> disimpan di Environment Variables Vercel, bukan di kode maupun di chat/
> screenshot mana pun — connection string yang pernah ter-expose harus
> di-rotate/reset, jangan dipakai lagi.

---

### Checklist tiap kali mengubah `prisma/schema.prisma`

Karena TIDAK ada automasi CI/CD, checklist ini harus dijalankan MANUAL,
urut, dan tidak boleh ada yang dilewat:

- [ ] Edit `prisma/schema.prisma` sesuai kebutuhan
- [ ] Jalankan `npx prisma generate` di lokal supaya tipe TypeScript ikut
      update (kalau ada error TypeScript tentang field yang "tidak ada",
      99% karena langkah ini belum dijalankan/di-restart)
- [ ] Jalankan `npm run db:push` ke database **lokal** dulu, test fitur
      barunya dengan ketiga role (admin/leader/staff) kalau perubahan
      terkait otorisasi
- [ ] **Restart** `npm run dev` (bukan hot-reload) — Next.js dev server bisa
      cache Prisma Client lama kalau tidak di-restart penuh
- [ ] Cek dulu isi database **production** untuk data yang mungkin konflik
      dengan perubahan schema (contoh: enum value yang mau dihapus tapi
      masih dipakai baris data) — lihat bagian "Migrasi dari skema role
      lama" untuk pola penanganannya
- [ ] Jalankan `DATABASE_URL="<production>" npx prisma db push` MANUAL dari
      lokal (tidak ada automasi untuk ini)
- [ ] Commit & push kode ke `main`
- [ ] Vercel otomatis build & deploy kode barunya (terpisah dari db push di
      atas — build TIDAK menjalankan `db push`, hanya `prisma generate`)
- [ ] Kalau ada env var BARU yang dipakai kode (bukan cuma schema), tambahkan
      manual juga di Vercel **Settings → Environment Variables**
- [ ] Setelah deploy sukses, login ke production dan tes ulang fitur yang
      terkait perubahan schema (terutama kalau perubahan menyentuh
      role/scope, tes dengan minimal satu akun dari tiap role)

---

## 4. Struktur Folder & Kenapa Begini

```
korin-task-management/
├── auth.ts                  # Konfigurasi Auth.js v5 (Credentials provider),
│                             #   session JWT menyertakan id/role/leaderId
├── proxy.ts                 # Pengganti middleware.ts (Next.js 16) — redirect
│                             #   ke /login kalau belum auth
├── types/next-auth.d.ts     # Augmentasi tipe session.user (id, role, leaderId)
├── prisma.config.ts         # config Prisma 7 (DATABASE_URL untuk CLI)
├── prisma/
│   ├── schema.prisma        # User(role/leaderId), Project, ProjectMember,
│   │                         #   Category, Task(parentId untuk subtask 1-level)
│   └── seed.ts               # script isi data contoh (5 user, 3-role, 1 project)
├── lib/
│   ├── prisma.ts             # koneksi Prisma + driver adapter (singleton)
│   ├── auth-helpers.ts        # PUSAT logic otorisasi & scope role — lihat
│   │                           #   Bagian 1 di atas SEBELUM mengubah file ini
│   ├── report-format.ts       # generate teks & grouping untuk Report WA
│   ├── generated/prisma/      # (auto-generate, jangan diedit manual)
│   └── types.ts               # tipe TypeScript yang dipakai di frontend
├── app/
│   ├── layout.tsx             # root layout + <Providers> + <Navbar>
│   ├── providers.tsx           # bungkus app dengan <SessionProvider>
│   ├── page.tsx                # redirect "/" -> "/projects"
│   ├── login/page.tsx          # halaman login
│   ├── projects/page.tsx        # daftar Project (admin: semua, lainnya: miliknya)
│   ├── projects/[id]/page.tsx   # detail Project: tab Daftar Task | Timeline |
│   │                             #   Anggota | History
│   ├── users/page.tsx           # kelola user (admin: semua, leader: stafnya)
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # endpoint internal Auth.js
│       ├── projects/route.ts              # GET (list, scoped) & POST (admin: buat)
│       ├── projects/[id]/route.ts          # GET/PATCH/DELETE satu project
│       ├── projects/[id]/members/route.ts  # GET (scoped) & POST (admin/leader)
│       ├── projects/[id]/members/[memberId]/route.ts  # PATCH/DELETE (scoped)
│       ├── tasks/route.ts                  # GET (list+filter, SCOPED per role)
│       │                                     #   & POST (buat, assignee divalidasi)
│       ├── tasks/[id]/route.ts             # GET/PATCH/DELETE satu task (SCOPED)
│       ├── users/route.ts                  # GET (scoped) & POST (siapa boleh
│       │                                     #   buat siapa, validasi domain email)
│       └── categories/route.ts             # GET & POST kategori per project
└── components/
    ├── Navbar.tsx             # nama user + role + tombol keluar
    ├── TaskListTree.tsx       # daftar task per status, expand row, render subtask
    ├── TaskFormModal.tsx      # modal form tambah/edit task (assignee dikunci
    │                           #   untuk staff — lihat prop currentUser)
    ├── FilterBar.tsx          # dropdown filter + tombol tambah task
    ├── CategoryManager.tsx    # badge kategori + form tambah kategori (admin)
    ├── ProjectFormModal.tsx   # modal form tambah project (admin)
    ├── AddMemberModal.tsx     # modal tambah anggota ke project
    ├── MemberList.tsx         # daftar anggota project + ubah peran/keluarkan
    ├── UserFormModal.tsx      # modal tambah/edit user (dropdown role hanya
    │                           #   muncul untuk admin — lihat prop currentUserRole)
    ├── Timeline.tsx           # tab agenda mingguan
    ├── TaskHistoryList.tsx    # tampilan read-only tab History (task DONE > H+1)
    └── WhatsAppReportModal.tsx  # preview report ala bubble chat WA + tombol copy
```

### Konsep kunci yang dipakai di project ini

**Model akses: Role global 3-tingkat + Peran kerja per-project**
Lihat Bagian 1 di atas untuk penjelasan lengkap role admin/leader/staff.
Terpisah dari role global itu, `ProjectMember.role` adalah **peran kerja
bebas teks** di project tertentu (misal "Project Lead", "Backend Developer",
"QA") — ini cuma label deskriptif, BUKAN dipakai untuk keputusan otorisasi.

**Auth.js v5 (next-auth@beta) dengan Credentials Provider**
Login pakai email + password (di-hash dengan bcrypt, lihat `auth.ts`).
Session disimpan sebagai JWT (bukan tabel Session terpisah) — field `id`,
`role`, dan `leaderId` disisipkan ke token lewat callback `jwt()`, lalu
diteruskan ke `session.user` lewat callback `session()`. Tipe TypeScript
untuk field tambahan ini dideklarasikan di `types/next-auth.d.ts`.

**`proxy.ts` (pengganti `middleware.ts` di Next.js 16)**
Jalan sebelum request mencapai halaman/route manapun (kecuali yang
dikecualikan di `matcher`). Tugasnya: redirect ke `/login` kalau belum
login, dan sebaliknya redirect ke `/` kalau sudah login tapi membuka
`/login`. **Proxy ini BUKAN satu-satunya lapisan keamanan** — setiap API
route tetap memvalidasi sesi & scope lewat `lib/auth-helpers.ts`, karena
keputusan otorisasi yang butuh data (misal "apakah task ini milik staf
si leader yang login?") tidak bisa dilakukan di level proxy.

**App Router & Route Handlers**
Folder `app/api/tasks/route.ts` otomatis menjadi endpoint `/api/tasks`.
Setiap file `route.ts` mengekspor fungsi bernama sesuai HTTP method
(`GET`, `POST`, `PATCH`, `DELETE`).

**Folder dinamis `[id]` dan `[memberId]`**
`app/api/projects/[id]/members/[memberId]/route.ts` menangani URL seperti
`/api/projects/abc123/members/xyz789`. Nilainya diakses lewat `params`
(berupa `Promise` di Next.js 15+, jadi harus `await`).

**List Tree (bukan Kanban drag-drop)**
Task ditampilkan per status (To Do/In Progress/Done) sebagai daftar yang
bisa di-expand per baris untuk lihat detail tanpa modal terpisah. Ubah
status lewat dropdown di tiap baris (`TaskListTree.tsx`), bukan drag-and-drop
seperti versi awal project ini — drag-drop sudah digantikan sepenuhnya.

**Subtask 1 Level**
Task bisa punya banyak subtask lewat self-relation `Task.parentId` /
`Task.subtasks`, TAPI subtask tidak boleh punya subtask lagi (validasi ini
dijaga manual di `app/api/tasks/route.ts` saat create, karena Prisma tidak
punya cara native membatasi "kedalaman" relasi self-referencing). Subtask
adalah task penuh (assignee/status/dueDate sendiri), ikut aturan History
sendiri, dan cascade delete kalau task induknya dihapus.

**History Otomatis (H+1)**
Task berstatus DONE yang sudah lebih dari 24 jam sejak `updatedAt` terakhir
otomatis "pindah" ke tab History dan disembunyikan dari tampilan aktif. Ini
dicek on-the-fly setiap request (`app/api/tasks/route.ts`, parameter
`view=active|history|all`), BUKAN lewat cron job terpisah.

**Report Summary ala WhatsApp**
Tombol "Report" di halaman detail Project membuka `WhatsAppReportModal`
yang menampilkan ringkasan task project (dikelompokkan per assignee, subtask
ikut tampil berindentasi) dalam tampilan bubble chat mirip WhatsApp asli.
Tidak ada endpoint API baru — modal ini memanggil ulang
`GET /api/tasks?projectId=xxx&view=all&flat=1`, yang otomatis SUDAH ter-scope
sesuai role yang login (staff/leader tidak akan melihat task orang lain di
laporannya sendiri).

Logika pengelompokan & format teks dipisah ke `lib/report-format.ts` supaya
**satu sumber data** dipakai baik untuk render bubble di modal maupun untuk
teks polos (dengan `*bold*` ala WA) yang disalin lewat tombol "Copy untuk
WhatsApp".

**Client Component vs Server Component**
Hampir semua halaman di sini adalah Client Component (`"use client"`)
karena sangat interaktif (modal, filter realtime, `useSession`). `layout.tsx`
tetap Server Component supaya bisa export `metadata`, makanya
`<SessionProvider>` dipisah ke `providers.tsx` yang baru di-"use client".

**Prisma sebagai ORM + Driver Adapter (khusus Prisma 7)**
`schema.prisma` mendefinisikan struktur tabel. Prisma 7 mewajibkan
`PrismaClient` diberi *driver adapter* eksplisit — untuk PostgreSQL kita
pakai `@prisma/adapter-pg` (lihat `lib/prisma.ts`).

**Pola Singleton Prisma Client (`lib/prisma.ts`)**
Next.js development mode melakukan hot-reload setiap kali file disimpan.
Tanpa pola ini, setiap reload akan membuat koneksi database baru yang
menumpuk. Kita simpan satu instance di variabel global dan pakai ulang.

---

## 5. Alur Data Singkat

```
User login di /login
        ↓
Auth.js verifikasi email+password (bcrypt.compare) → buat session JWT
        (menyertakan id, role, leaderId)
        ↓
Redirect ke /projects → fetch GET /api/projects
        ↓ (admin: semua project | leader/staff: project tempat dia terdaftar)
Klik salah satu project → /projects/[id]
        ↓
Tab "Daftar Task" → fetch GET /api/tasks?projectId=xxx&view=active
        (hasil OTOMATIS ter-scope: admin semua, leader dirinya+staf,
         staff hanya dirinya sendiri)
Tab "Timeline"     → fetch GET /api/tasks?...&view=all&flat=1
Tab "Anggota"      → fetch GET /api/projects/[id]/members (scoped juga)
Tab "History"      → fetch GET /api/tasks?...&view=history
        ↓
Submit form task (tambah/edit/hapus) → POST/PATCH/DELETE /api/tasks
        (server validasi ulang scope & hak assign, TIDAK percaya body request
         mentah dari client)
        ↓
Prisma simpan ke PostgreSQL → fetch ulang data terkait → UI re-render
```

---

## 6. Riwayat Masalah yang Sudah Diselesaikan (biar tidak terulang)

1. **Login gagal setelah ubah schema** → penyebab: dev server tidak
   di-restart setelah `prisma generate`/`db push` (Prisma Client lama
   ter-cache). **Solusi:** selalu restart `npm run dev` setelah perubahan
   schema.

2. **404 di halaman tertentu (Next.js 404 resmi)** → penyebab: file
   `page.tsx` sempat tertimpa/hilang saat proses gabung revisi manual.
   **Solusi:** `git diff --stat` setelah menimpa file dari paket revisi,
   untuk mendeteksi file yang berubah drastis (indikasi salah taruh).

3. **Database production kosong/belum ada tabel** → penyebab: `db push`
   belum pernah dijalankan ke `DATABASE_URL` **production** (beda dari
   lokal). **Solusi:** selalu jalankan
   `DATABASE_URL="<production>" npx prisma db push` setiap ada perubahan
   schema, ke DUA tempat (lokal & production) — lihat checklist di Bagian 3.

4. **`The column Task.parentId does not exist` / `User.leaderId does not
   exist`** di production padahal kolomnya sudah ada di database (via
   Prisma Studio) → dua kemungkinan penyebab:
   - Env var yang terpasang di Vercel BUKAN persis bernama `DATABASE_URL`
     (misal `DB_PRISMA_DATABASE_URL`), jadi runtime connect ke database yang
     salah/lain. **Solusi:** tambahkan env var bernama PERSIS `DATABASE_URL`
     di Vercel Settings.
   - `prisma generate` belum dijalankan ulang setelah schema berubah, jadi
     Prisma Client yang dipakai runtime masih versi lama yang tidak kenal
     kolom baru. **Solusi:** jalankan `npx prisma generate` lalu restart
     server (lokal) atau redeploy tanpa build cache (Vercel).

5. **`prisma db push` gagal dengan warning "values [member] on the enum
   GlobalRole will be removed"** → penyebab: masih ada baris `User` dengan
   `role = 'member'` dari skema role lama (sebelum revisi admin/leader/
   staff), dan Postgres tidak mengizinkan value enum dihapus selagi masih
   dipakai. **Solusi:** migrasikan dulu manual — lihat bagian "Migrasi dari
   skema role lama" di Bagian 2.

## Catatan Keamanan

- Jangan pernah commit file `.env` atau connection string apa pun ke git,
  chat, atau screenshot yang dibagikan ke pihak lain.
- Kalau sebuah connection string production pernah ter-expose (di chat, log,
  screenshot, dsb), **rotate/reset connection string itu** secepatnya di
  dashboard provider database-mu — jangan asumsikan itu tetap aman dipakai.
- Field `password` di model `User` HANYA pernah menyimpan hash bcrypt
  (route API manapun tidak pernah mengembalikan field ini ke client — cek
  `PUBLIC_USER_FIELDS` di `app/api/users/route.ts` kalau menambah field
  sensitif baru, pastikan tidak ikut ter-expose).

---

## 7. Ide Pengembangan Lanjutan

- **Halaman registrasi mandiri** dengan approval admin/leader, daripada
  admin/leader membuat user secara manual satu-satu.
- **Reset password / lupa password** (perlu integrasi pengiriman email).
- **Komentar/log aktivitas** per task.
- **Notifikasi due date** yang sudah lewat (highlight warna merah).
- **Audit log** siapa menambah/menghapus anggota project atau memindahkan
  staff ke leader lain, kapan.
- **Automasi sinkronisasi schema** — pertimbangkan GitHub Action yang
  menjalankan `prisma migrate deploy` (berbasis file migrasi, ada riwayat &
  lebih aman daripada `db push` manual) setiap merge ke `main`, supaya
  langkah "push schema ke production manual" di Bagian 3 tidak lagi jadi
  langkah manual yang gampang terlewat.
- **Connection pooling** — kalau traffic mulai ramai di production, cek
  apakah provider Postgres yang dipakai sudah mengaktifkan pooled connection
  string (biasanya ada di env var terpisah), supaya tidak kehabisan koneksi
  di environment serverless Vercel.
- **Leader bisa memindahkan staff ke leader lain** — saat ini hanya admin
  yang bisa mengubah `leaderId` seorang staff (lihat `app/api/users/[id]/route.ts`).
