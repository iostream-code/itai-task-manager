# Task Manager — Tim IT

Aplikasi manajemen task berbasis **Project**: admin membuat Project, menambah
anggota tim ke Project tersebut beserta peran kerjanya (Project Lead,
Developer, QA, dll), lalu tim bekerja di Kanban board (To Do / In Progress /
Done) khusus Project itu.

Dibuat dengan: **Next.js 16 (App Router)** + **TypeScript** + **TailwindCSS v4**
+ **Prisma** + **PostgreSQL** + **Auth.js v5 (next-auth)**.

---

## 1. Cara Menjalankan di Lokal

Kamu butuh database PostgreSQL yang jalan duluan. Cara paling cepat tanpa
install Postgres manual adalah pakai Docker:

```bash
docker run --name task-manager-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=task_manager \
  -p 5432:5432 \
  -d postgres:16
```

Kalau tidak pakai Docker, install PostgreSQL secara lokal lalu buat database
kosong bernama `task_manager`.

```bash
# 1. Copy contoh env, lalu isi DATABASE_URL dan AUTH_SECRET
cp .env.example .env
```

Isi `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/task_manager
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

# 5. Isi database dengan data contoh (3 user, 1 project, 3 task)
npm run db:seed

# 6. Jalankan development server
npm run dev
```

Lalu buka **http://localhost:3000** — kamu akan diarahkan ke halaman login.

### Akun contoh (dari `db:seed`)

Semua akun memakai password yang sama: `password123`

| Email                  | Role (global) | Peran di project "Internal Tools" |
|-------------------------|----------------|------------------------------------|
| budi@indokoper.id       | **admin**      | Project Lead                       |
| sari@indokoper.id       | member         | Backend Developer                  |
| andi@indokoper.id       | member         | QA                                 |

Login sebagai `budi@indokoper.id` untuk mencoba fitur admin (buat project,
kelola anggota). Login sebagai `sari@indokoper.id` / `andi@indokoper.id`
untuk melihat dari sudut pandang member biasa.

> Ganti password contoh ini sebelum dipakai sungguhan — lihat bagian
> "Menambah user baru" di bawah.

### Menambah user baru

Belum ada halaman registrasi mandiri (sengaja — supaya admin yang
mengontrol siapa saja yang boleh punya akun). Untuk menambah user:

- **Lewat admin yang sudah login**: panggil `POST /api/users` (lihat
  `app/api/users/route.ts`) — body: `{ name, email, password, role }`.
  Bisa lewat halaman manapun yang sudah login sebagai admin menggunakan
  `fetch`, atau lewat tool seperti Postman/curl dengan cookie sesi admin.
- **Lewat seed**: edit `prisma/seed.ts` lalu jalankan ulang `npm run db:seed`
  (perhatian: script ini menghapus semua data lama dulu).

### Database Browser (opsional, sangat membantu saat belajar)

```bash
npm run db:studio
```

Ini membuka GUI di browser untuk melihat & edit isi database secara visual.

---

## 2. Deploy ke Vercel dengan PostgreSQL

1. **Push project ini ke GitHub** (repo baru), lalu di dashboard Vercel pilih
   **Add New → Project** dan import repo tersebut.

2. **Tambahkan database Postgres** — di dashboard project Vercel, buka tab
   **Storage → Create Database**, lalu pilih provider Postgres yang tersedia
   (misalnya **Neon** atau **Supabase**). Vercel otomatis membuatkan database
   dan menyuntikkan env var koneksinya ke project (umumnya sebagai
   `DATABASE_URL`, atau `POSTGRES_URL` / `POSTGRES_PRISMA_URL` tergantung
   provider yang dipilih).

3. **Samakan nama env var.** Project ini membaca `DATABASE_URL` di
   `prisma.config.ts` dan `lib/prisma.ts`. Jika Vercel memberi nama lain
   (misalnya `POSTGRES_URL`), buka **Settings → Environment Variables** di
   project Vercel, lalu tambahkan satu env var baru bernama `DATABASE_URL`
   dengan value yang sama (copy dari connection string yang Vercel berikan).

4. **Tambahkan `AUTH_SECRET`** di **Settings → Environment Variables**,
   isinya hasil `openssl rand -base64 33` (generate yang BARU, jangan dipakai
   ulang dari lokal). Auth.js juga otomatis membaca env var `AUTH_URL` kalau
   ada, tapi di Vercel ini biasanya tidak perlu diisi manual karena Auth.js
   bisa mendeteksi domain dari header request.

5. **Setting npm install**: karena next-auth beta belum menyatakan dukungan
   resmi Next.js 16 di peer dependency, tambahkan **Install Command** custom
   di **Settings → General → Build & Development Settings**:
   ```
   npm install --legacy-peer-deps
   ```

6. **Build command sudah otomatis menjalankan `prisma generate`** — lihat
   script `build` di `package.json` (`prisma generate && next build`), jadi
   tidak perlu setting tambahan untuk ini.

7. **Push schema awal ke database production**, sebelum deploy pertama kali
   (setelah ini, perubahan schema lanjutan akan otomatis lewat GitHub Action
   — lihat poin 9). Jalankan dari komputer lokal dengan `DATABASE_URL`
   diarahkan ke database production:
   ```bash
   DATABASE_URL="<connection string dari Vercel>" npx prisma db push
   ```
   Lalu buat MINIMAL satu user admin (lewat seed yang disesuaikan, atau
   lewat `prisma studio` untuk insert manual dengan password yang sudah
   di-hash bcrypt).

8. **Deploy.** Klik Deploy di Vercel (atau push ke branch yang terhubung).
   Vercel otomatis re-deploy setiap ada push ke branch production — ini
   namanya Git Integration, aktif otomatis sejak project di-import dari
   GitHub.

9. **Setup GitHub Secret untuk auto db-push.** Project ini punya GitHub
   Action (`.github/workflows/db-push.yml`) yang otomatis menjalankan
   `prisma db push` ke database production setiap ada push ke `main` YANG
   mengubah `prisma/schema.prisma`. Supaya workflow ini bisa konek ke
   database, tambahkan secret di GitHub:
   - Buka repo → **Settings → Secrets and variables → Actions**
   - **New repository secret** → Name: `DATABASE_URL`, Value: connection
     string yang SAMA dengan yang dipakai di Vercel
   - Tanpa secret ini, workflow akan gagal (`DATABASE_URL` kosong)

   > ⚠️ **Catatan penting soal `db push` otomatis**: command ini langsung
   > menyamakan struktur database dengan `schema.prisma`, dan dijalankan
   > dengan flag `--accept-data-loss` (wajib untuk mode non-interactive di
   > CI). Artinya perubahan yang sifatnya destruktif (hapus kolom yang masih
   > ada datanya, dst) akan **langsung dieksekusi tanpa konfirmasi**. Ini
   > cocok untuk tahap development, tapi kalau project sudah punya data
   > production yang penting, pertimbangkan beralih ke `prisma migrate
   > deploy` (berbasis file migrasi, ada riwayat & lebih aman) dan hapus
   > workflow auto db-push ini.

> Catatan: jangan commit file `.env` ke git (sudah di-ignore lewat
> `.gitignore`). Semua secret (DATABASE_URL, AUTH_SECRET) cukup disimpan di
> Environment Variables Vercel & GitHub Secrets, bukan di kode.

---

### Checklist tiap kali mengubah `prisma/schema.prisma`

- [ ] Edit `prisma/schema.prisma` sesuai kebutuhan
- [ ] Jalankan `npx prisma generate` di lokal supaya tipe TypeScript ikut update
- [ ] Jalankan `npm run db:push` ke database **lokal** dulu, test fitur barunya
- [ ] Commit & push ke `main` (atau merge PR ke `main`)
- [ ] GitHub Action `Sync Database Schema` otomatis jalan → push schema ke
      database **production**. Cek statusnya di tab **Actions** repo GitHub
- [ ] Vercel otomatis build & deploy kode barunya (terpisah dari proses di
      atas, tapi biasanya jalan bersamaan)
- [ ] Kalau ada env var BARU yang dipakai kode (bukan cuma schema), tambahkan
      manual juga di Vercel **Settings → Environment Variables** — ini TIDAK
      otomatis ikut ter-deploy hanya dari push GitHub

---

## 3. Struktur Folder & Kenapa Begini

```
task-manager/
├── .github/workflows/db-push.yml  # GitHub Action: auto `prisma db push` ke
│                                   #   production tiap schema.prisma berubah
├── auth.ts                  # Konfigurasi Auth.js v5 (Credentials provider)
├── proxy.ts                 # Pengganti middleware.ts (Next.js 16) — redirect
│                             #   ke /login kalau belum auth
├── types/next-auth.d.ts     # Augmentasi tipe session.user (id, role)
├── prisma.config.ts         # config Prisma 7 (DATABASE_URL untuk CLI)
├── prisma/
│   ├── schema.prisma        # User, Project, ProjectMember, Category, Task
│   └── seed.ts               # script isi data contoh
├── lib/
│   ├── prisma.ts             # koneksi Prisma + driver adapter (singleton)
│   ├── auth-helpers.ts        # getCurrentUser / isAdmin / canAccessProject
│   ├── report-format.ts       # generate teks & grouping untuk Report WA
│   ├── generated/prisma/      # (auto-generate, jangan diedit manual)
│   └── types.ts               # tipe TypeScript yang dipakai di frontend
├── app/
│   ├── layout.tsx             # root layout + <Providers> + <Navbar>
│   ├── providers.tsx           # bungkus app dengan <SessionProvider>
│   ├── page.tsx                # redirect "/" -> "/projects"
│   ├── login/page.tsx          # halaman login
│   ├── projects/page.tsx        # daftar Project (admin: semua, member: miliknya)
│   ├── projects/[id]/page.tsx   # detail Project: tab Anggota + Kanban Board
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # endpoint internal Auth.js
│       ├── projects/route.ts              # GET (list) & POST (admin: buat)
│       ├── projects/[id]/route.ts          # GET/PATCH/DELETE satu project
│       ├── projects/[id]/members/route.ts  # GET (list) & POST (admin: tambah)
│       ├── projects/[id]/members/[memberId]/route.ts  # PATCH role / DELETE
│       ├── tasks/route.ts                  # GET (list+filter) & POST (buat)
│       ├── tasks/[id]/route.ts             # GET satu, PATCH (update), DELETE
│       ├── users/route.ts                  # GET (list) & POST (admin: buat)
│       └── categories/route.ts             # GET & POST kategori per project
└── components/
    ├── Navbar.tsx            # nama user login + tombol keluar
    ├── BoardColumn.tsx       # satu kolom Kanban (To Do/In Progress/Done)
    ├── TaskCard.tsx          # satu kartu task
    ├── TaskFormModal.tsx     # modal form tambah/edit task
    ├── FilterBar.tsx         # dropdown filter + tombol tambah task
    ├── CategoryManager.tsx   # badge kategori + form tambah kategori (admin)
    ├── ProjectFormModal.tsx  # modal form tambah project (admin)
    ├── AddMemberModal.tsx    # modal tambah anggota ke project (admin)
    ├── MemberList.tsx        # daftar anggota project + ubah peran/keluarkan
    └── WhatsAppReportModal.tsx  # preview report ala bubble chat WA + tombol copy
```

### Konsep kunci yang dipakai di project ini

**Model akses: Role global + Peran per-project**
Setiap `User` punya `role` GLOBAL: `admin` atau `member`.
- **Admin** bisa membuat/menghapus Project, menambah/menghapus anggota di
  Project apa pun, dan otomatis punya akses ke SEMUA Project meski tidak
  didaftarkan manual sebagai anggota.
- **Member** hanya bisa melihat & bekerja di Project yang dia terdaftar
  sebagai anggota lewat tabel `ProjectMember`.

Terpisah dari role global itu, `ProjectMember.role` adalah **peran kerja
bebas teks** di project tertentu (misal "Project Lead", "Backend Developer",
"QA") — ini cuma label deskriptif, BUKAN dipakai untuk keputusan otorisasi.
Keputusan "boleh akses project ini atau tidak" murni dari: admin global,
ATAU terdaftar di `ProjectMember` untuk project itu.

**Auth.js v5 (next-auth@beta) dengan Credentials Provider**
Login pakai email + password (di-hash dengan bcrypt, lihat `auth.ts`).
Session disimpan sebagai JWT (bukan tabel Session terpisah) — field `id` dan
`role` disisipkan ke token lewat callback `jwt()`, lalu diteruskan ke
`session.user` lewat callback `session()`. Tipe TypeScript untuk field
tambahan ini dideklarasikan di `types/next-auth.d.ts`.

**`proxy.ts` (pengganti `middleware.ts` di Next.js 16)**
Jalan sebelum request mencapai halaman/route manapun (kecuali yang
dikecualikan di `matcher`). Tugasnya: redirect ke `/login` kalau belum
login, dan sebaliknya redirect ke `/` kalau sudah login tapi membuka
`/login`. **Proxy ini BUKAN satu-satunya lapisan keamanan** — setiap API
route tetap memvalidasi sesi & akses lewat `lib/auth-helpers.ts`, karena
keputusan otorisasi yang butuh data (misal "apakah user ini anggota project
X?") tidak bisa dilakukan di level proxy.

**App Router & Route Handlers**
Folder `app/api/tasks/route.ts` otomatis menjadi endpoint `/api/tasks`.
Setiap file `route.ts` mengekspor fungsi bernama sesuai HTTP method
(`GET`, `POST`, `PATCH`, `DELETE`).

**Folder dinamis `[id]` dan `[memberId]`**
`app/api/projects/[id]/members/[memberId]/route.ts` menangani URL seperti
`/api/projects/abc123/members/xyz789`. Nilainya diakses lewat `params`
(berupa `Promise` di Next.js 15+, jadi harus `await`).

**Report Summary ala WhatsApp**
Tombol "📱 Generate Report" di halaman detail Project membuka
`WhatsAppReportModal` yang menampilkan ringkasan SEMUA task project
(dikelompokkan per assignee) dalam tampilan bubble chat mirip WhatsApp asli
(warna header `#075E54`, background bubble `#e5ddd5`, centang biru, dll).
Tidak ada endpoint API baru — modal ini memanggil ulang `GET /api/tasks?projectId=`
tanpa filter, supaya laporan selalu mencakup seluruh task apa pun filter yang
sedang aktif di tab Kanban Board.

Logika pengelompokan & format teks dipisah ke `lib/report-format.ts` supaya
**satu sumber data** dipakai baik untuk render bubble di modal maupun untuk
teks polos (dengan `*bold*` ala WA) yang disalin lewat tombol "Copy untuk
WhatsApp" — keduanya tidak bisa saling berbeda karena berasal dari fungsi
yang sama (`formatTaskLine`, `groupTasksByAssignee`).

**Client Component vs Server Component**
Hampir semua halaman di sini adalah Client Component (`"use client"`)
karena sangat interaktif (drag-drop, modal, filter realtime, `useSession`).
`layout.tsx` tetap Server Component supaya bisa export `metadata`, makanya
`<SessionProvider>` dipisah ke `providers.tsx` yang baru di-"use client".

**Prisma sebagai ORM + Driver Adapter (khusus Prisma 7)**
`schema.prisma` mendefinisikan struktur tabel. Prisma 7 mewajibkan
`PrismaClient` diberi *driver adapter* eksplisit — untuk PostgreSQL kita
pakai `@prisma/adapter-pg` (lihat `lib/prisma.ts`).

**Pola Singleton Prisma Client (`lib/prisma.ts`)**
Next.js development mode melakukan hot-reload setiap kali file disimpan.
Tanpa pola ini, setiap reload akan membuat koneksi database baru yang
menumpuk. Kita simpan satu instance di variabel global dan pakai ulang.

**Optimistic UI Update**
Lihat fungsi `handleDropTask` di `app/projects/[id]/page.tsx`. Saat
drag-drop kartu, tampilan diupdate **duluan** sebelum menunggu response dari
server. Kalau request API gagal, baru kita fetch ulang data yang benar.

**HTML5 Drag and Drop API (native)**
Drag-and-drop di board (`BoardColumn.tsx`) tidak memakai library tambahan,
cukup atribut `draggable` + event `onDragStart`, `onDragOver`, `onDrop`.

---

## 4. Alur Data Singkat

```
User login di /login
        ↓
Auth.js verifikasi email+password (bcrypt.compare) → buat session JWT
        ↓
Redirect ke /projects → fetch GET /api/projects
        ↓ (admin: semua project | member: project miliknya saja)
Klik salah satu project → /projects/[id]
        ↓
Tab "Kanban Board" → fetch GET /api/tasks?projectId=xxx
Tab "Anggota"      → data anggota dari GET /api/projects/[id] (sudah include)
        ↓
Drag kartu task / submit form → PATCH atau POST /api/tasks
        ↓
Prisma simpan ke PostgreSQL → fetchTasks() dipanggil lagi → board re-render
```

---

## 5. Ide Pengembangan Lanjutan (kalau mau lanjut belajar)

- **Halaman registrasi mandiri** dengan approval admin, daripada admin
  membuat user secara manual lewat API.
- **Reset password / lupa password** (perlu integrasi pengiriman email).
- **Komentar/log aktivitas** per task.
- **Notifikasi due date** yang sudah lewat (highlight warna merah).
- **Audit log** siapa menambah/menghapus anggota project, kapan.
- **Connection pooling** — kalau traffic mulai ramai di production, cek
  apakah provider Postgres yang dipakai (Neon/Supabase) sudah mengaktifkan
  pooled connection string (biasanya ada di env var terpisah, contoh
  `POSTGRES_PRISMA_URL` / `*_POOLED`), supaya tidak kehabisan koneksi di
  environment serverless Vercel.