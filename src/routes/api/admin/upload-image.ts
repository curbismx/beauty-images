import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FILENAME_RE = /^a(\d{8})\.[a-z0-9]+$/i;
const IMAGE_FILE_RE = /\.(jpe?g|png|webp|gif)$/i;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cleanFilename(name: string) {
  return name.split(/[\\/]/).pop()?.trim() || "upload.jpg";
}

function extensionFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return ext === "jpeg" ? "jpg" : ext;
}

function contentTypeFor(file: File, ext: string) {
  if (file.type?.startsWith("image/")) return file.type;
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice("Bearer ".length);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Backend is missing auth configuration");

  const userClient = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");

  const { data: roleRow, error: roleErr } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleErr || !roleRow) throw new Error("Unauthorized");
}

export const Route = createFileRoute("/api/admin/upload-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdmin(request);

          const rawFilename = request.headers.get("x-filename");
          if (!rawFilename) {
            return json({ ok: false, message: "Missing filename header" }, 400);
          }
          const filename = cleanFilename(decodeURIComponent(rawFilename));
          const ext = extensionFor(filename);
          const headerType = request.headers.get("content-type") || "";
          const fileLike = { type: headerType.startsWith("image/") ? headerType : "" } as File;
          const contentType = contentTypeFor(fileLike, ext);

          const buffer = await request.arrayBuffer();
          const file = new File([buffer], filename, { type: contentType });

          const detectedDigits = filename.match(/^a(\d+)\./i)?.[1];
          const detectedNumber = detectedDigits?.length === 8 ? parseInt(detectedDigits, 10) : null;

          if (!file.size || !(contentType.startsWith("image/") || IMAGE_FILE_RE.test(filename))) {
            return json({ ok: false, message: "Only image files can be uploaded" }, 400);
          }

          const saveUploadError = async (message: string, existingPath?: string | null) => {
            let storagePath = existingPath ?? null;
            if (!storagePath) {
              storagePath = `upload-errors/${crypto.randomUUID()}.${ext}`;
              const { error: uploadErr } = await supabaseAdmin.storage
                .from("images-private")
                .upload(storagePath, file, { contentType, upsert: false });
              if (uploadErr) throw new Error(`${message}; also failed to store error file: ${uploadErr.message}`);
            }

            const { error: recordErr } = await supabaseAdmin.from("upload_errors").insert({
              filename,
              storage_path: storagePath,
              error_message: message,
              detected_image_number: detectedNumber,
            });
            if (recordErr) throw new Error(`${message}; also failed to save error record: ${recordErr.message}`);
          };

          const match = filename.match(FILENAME_RE);
          if (!match) {
            const message = detectedDigits && detectedDigits.length !== 8
              ? `Invalid filename — found ${detectedDigits.length} digits after A, must be exactly 8`
              : "Invalid filename — must be A + 8 digits + extension";
            await saveUploadError(message);
            return json({ ok: false, message });
          }

          const imageNumber = parseInt(match[1], 10);
          const { count, error: dupErr } = await supabaseAdmin
            .from("images")
            .select("id", { count: "exact", head: true })
            .eq("image_number", imageNumber);
          if (dupErr) throw new Error(`Number check failed: ${dupErr.message}`);
          if ((count ?? 0) > 0) {
            const message = `Duplicate number — #${String(imageNumber).padStart(8, "0")} already exists`;
            await saveUploadError(message);
            return json({ ok: false, message });
          }

          const storagePath = `${crypto.randomUUID()}.${ext}`;
          const { error: uploadErr } = await supabaseAdmin.storage
            .from("images-private")
            .upload(storagePath, file, { contentType, upsert: false });
          if (uploadErr) throw new Error(uploadErr.message);

          const { data: inserted, error: insertErr } = await supabaseAdmin
            .from("images")
            .insert({ filename, storage_path: storagePath, image_number: imageNumber })
            .select("image_number")
            .single();
          if (insertErr) {
            await saveUploadError(insertErr.message, storagePath);
            return json({ ok: false, message: insertErr.message });
          }

          return json({ ok: true, imageNumber: inserted.image_number });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          const status = message === "Unauthorized" ? 401 : 500;
          return json({ ok: false, message }, status);
        }
      },
    },
  },
});