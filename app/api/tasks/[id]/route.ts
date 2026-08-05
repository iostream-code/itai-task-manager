import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/auth-helpers";

// Ambang waktu "History": task berstatus DONE yang statusnya (updatedAt)
// sudah lebih dari 24 jam yang lalu dianggap masuk History, dan disembunyikan
// dari tampilan board/list aktif secara default. Tidak ada job/cron terpisah
// — ini dicek on-the-fly setiap kali data task diambil, dengan membandingkan
// `updatedAt` terhadap waktu saat request dijalankan.
const HISTORY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // H+1

// GET /api/tasks?projectId=xxx
// Mengambil task DI DALAM satu project, bisa difilter lewat query string
// tambahan, contoh: /api/tasks?projectId=xxx&status=TODO&categoryId=abc123
//
// projectId WAJIB — task selalu terikat ke satu project, dan kita harus
// tahu project mana untuk mengecek apakah user yang request punya akses.
//
// Query opsional `view`:
//   - "active" (default) -> task board/list biasa. Task DONE yang sudah
//     lewat H+1 SEJAK terakhir diupdate (lihat HISTORY_THRESHOLD_MS)
//     disembunyikan dari sini karena sudah "pindah" ke History.
//   - "history" -> kebalikannya, HANYA task DONE yang sudah lewat H+1.
//     Dipakai oleh halaman /projects/[id]/history.
//   - "all" -> tidak ada filter history sama sekali (dipakai oleh Report,
//     supaya laporan tetap mencakup seluruh task apa pun umur statusnya).
//
// Subtask (1 level):
//   - Secara DEFAULT, hanya task TOP-LEVEL (parentId null) yang dikembalikan,
//     masing-masing menyertakan array `subtasks`-nya sendiri (juga sudah
//     kena filter view yang sama). Ini dipakai List Tree, supaya subtask
//     tidak dobel muncul sebagai baris top-level terpisah.
//   - `?flat=1` mengembalikan SEMUA task apa adanya (top-level + subtask)
//     sebagai satu daftar rata tanpa nesting — dipakai Timeline (perlu tiap
//     task individual untuk taruh di tanggalnya masing-masing) dan Report
//     (perlu subtask sebagai baris sendiri, lihat lib/report-format.ts).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const categoryId = searchParams.get("categoryId");
  const assigneeId = searchParams.get("assigneeId");
  const view = searchParams.get("view") || "active";
  const flat = searchParams.get("flat") === "1";

  if (!projectId) {
    return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(projectId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Kamu tidak punya akses ke project ini" },
      { status: 403 }
    );
  }

  // Bangun objek "where" secara dinamis.
  // Kalau query param tidak ada, filter itu tidak dipakai.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { projectId };
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (assigneeId) where.assigneeId = assigneeId;

  const historyCutoff = new Date(Date.now() - HISTORY_THRESHOLD_MS);

  if (view === "history") {
    // Hanya task DONE yang sudah "matang" lebih dari 24 jam.
    where.status = "DONE";
    where.updatedAt = { lte: historyCutoff };
  } else if (view === "active") {
    // Sembunyikan task DONE yang sudah lewat 24 jam dari tampilan aktif.
    // Task DONE yang BARU saja diubah (< 24 jam) tetap tampil seperti biasa.
    // NOT di sini membungkus SATU kondisi gabungan (status DONE *dan*
    // updatedAt lama) — bukan dua kondisi NOT terpisah — supaya artinya
    // tepat "kecualikan task yang DONE **sekaligus** sudah lama diupdate".
    where.NOT = { AND: [{ status: "DONE" }, { updatedAt: { lte: historyCutoff } }] };
  }
  // view === "all": tidak ada filter tambahan sama sekali.

  try {
    if (flat) {
      // Mode rata: kembalikan semua task (top-level + subtask) sebagai satu
      // daftar, masing-masing tetap menyertakan relasi assignee/category
      // seperti biasa. Tidak ada filter parentId di sini.
      const tasks = await prisma.task.findMany({
        where,
        include: { assignee: true, category: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(tasks);
    }

    // Mode default: hanya task top-level, masing-masing bawa subtasks-nya.
    // Subtask ikut kena filter `where` yang sama (status/kategori/assignee/
    // view) supaya konsisten dengan task top-level yang sedang ditampilkan.
    const tasks = await prisma.task.findMany({
      where: { ...where, parentId: null },
      include: {
        assignee: true,
        category: true,
        subtasks: {
          where,
          include: { assignee: true, category: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data task" },
      { status: 500 }
    );
  }
}

// POST /api/tasks
// Membuat task baru. Body request berupa JSON, projectId WAJIB disertakan.
// `parentId` opsional — kalau diisi, task baru ini jadi SUBTASK dari task
// dengan id tersebut (lihat validasi 1-level di bawah).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assigneeId,
      categoryId,
      projectId,
      parentId,
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId wajib diisi" }, { status: 400 });
    }

    const hasAccess = await canAccessProject(projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Kamu tidak punya akses ke project ini" },
        { status: 403 }
      );
    }

    // Validasi sederhana di server.
    // Jangan percaya 100% sama validasi di frontend saja.
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "Judul task wajib diisi" },
        { status: 400 }
      );
    }

    // Validasi subtask 1 LEVEL SAJA: kalau parentId diisi, task induknya
    // WAJIB ada, satu project yang sama, dan task induk itu sendiri BUKAN
    // subtask (parentId-nya sendiri harus null) — supaya tidak ada rantai
    // subtask-dari-subtask.
    if (parentId) {
      const parentTask = await prisma.task.findUnique({ where: { id: parentId } });
      if (!parentTask || parentTask.projectId !== projectId) {
        return NextResponse.json(
          { error: "Task induk tidak ditemukan di project ini" },
          { status: 400 }
        );
      }
      if (parentTask.parentId !== null) {
        return NextResponse.json(
          { error: "Task induk ini sendiri adalah subtask — subtask tidak boleh berjenjang" },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        status: status || "TODO",
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId || null,
        categoryId: categoryId || null,
        projectId,
        parentId: parentId || null,
      },
      include: {
        assignee: true,
        category: true,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Gagal membuat task" },
      { status: 500 }
    );
  }
}
